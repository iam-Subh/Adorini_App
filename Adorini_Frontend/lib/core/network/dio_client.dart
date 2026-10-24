import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show VoidCallback;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../constants/api_constants.dart';
import '../../features/auth/domain/auth_controller.dart';
import '../storage/token_storage.dart';

final Provider<TokenStorage> tokenStorageProvider = Provider<TokenStorage>(
  (Ref ref) => TokenStorage(),
);

final Provider<Dio> dioProvider = Provider<Dio>((Ref ref) {
  final TokenStorage tokenStorage = ref.watch(tokenStorageProvider);
  return DioClient(
    tokenStorage,
    // Read lazily inside the callback, never during this build: AuthController
    // reaches back to this provider for its own Dio, so resolving it here would
    // be a dependency cycle. By the time a session expires, both exist.
    onSessionExpired: () =>
        ref.read(authControllerProvider.notifier).markSessionExpired(),
  ).dio;
});

/// Wraps a [Dio] instance with auth-header injection and a single
/// retry-after-refresh on 401, matching Adorini_Backend's JwtAuthGuard
/// (15-minute access token + refresh-token endpoint).
class DioClient {
  DioClient(this._tokenStorage, {this.onSessionExpired}) {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (RequestOptions options, RequestInterceptorHandler handler) async {
          final String? token = await _tokenStorage.readAccessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (DioException error, ErrorInterceptorHandler handler) async {
          final bool isUnauthorized = error.response?.statusCode == 401;
          final bool alreadyRetried = error.requestOptions.extra['retried'] == true;

          if (isUnauthorized && !alreadyRetried) {
            final bool refreshed = await _refreshToken();
            if (refreshed) {
              final RequestOptions retryRequest = error.requestOptions
                ..extra['retried'] = true;
              try {
                final Response<dynamic> response = await _dio.fetch(retryRequest);
                return handler.resolve(response);
              } on DioException catch (retryError) {
                return handler.next(retryError);
              }
            }
            await _tokenStorage.clear();
            onSessionExpired?.call();
          }
          handler.next(error);
        },
      ),
    );
  }

  final TokenStorage _tokenStorage;

  /// Called once the session is gone for good - the refresh token was rejected
  /// and local tokens have been cleared.
  ///
  /// Without this the app kept `AuthStatus.authenticated` while holding no
  /// tokens at all: every protected screen rendered its own error ("Could not
  /// load your account") and the router, which only redirects on status, never
  /// offered a way back to sign-in. A dead end that a restart did not clear.
  final VoidCallback? onSessionExpired;

  late final Dio _dio;

  /// The refresh currently in flight, shared by every caller.
  Future<bool>? _refreshInFlight;

  Dio get dio => _dio;

  /// Refreshes the session, collapsing concurrent callers into one request.
  ///
  /// **This is why the app was signing itself out.** Refresh tokens are
  /// single-use, and the backend treats a re-presented token as theft by
  /// revoking every session for that user. The Account screen fires several
  /// protected requests at once; when the access token expired they all got 401
  /// together, each called this method with the *same* stored refresh token, the
  /// first rotated it, and the rest handed back a spent one. The server did
  /// exactly what it should and killed every session on the account.
  ///
  /// Sharing one in-flight future means the token is spent once, and the other
  /// callers wait for its result.
  Future<bool> _refreshToken() {
    return _refreshInFlight ??= _performRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<bool> _performRefresh() async {
    final String? refreshToken = await _tokenStorage.readRefreshToken();
    if (refreshToken == null) return false;

    try {
      final Dio refreshDio = Dio(BaseOptions(baseUrl: ApiConstants.baseUrl));
      final Response<Map<String, dynamic>> response = await refreshDio.post<Map<String, dynamic>>(
        ApiConstants.refresh,
        data: <String, String>{'refreshToken': refreshToken},
      );

      final String? newAccessToken = response.data?['accessToken'] as String?;
      final String? newRefreshToken = response.data?['refreshToken'] as String?;
      if (newAccessToken == null || newRefreshToken == null) return false;

      await _tokenStorage.saveTokens(
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      );
      return true;
    } on DioException {
      return false;
    }
  }
}
