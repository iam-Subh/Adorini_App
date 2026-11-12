import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../auth/domain/auth_controller.dart';
import '../../auth/domain/auth_state.dart';
import '../data/catalog_api.dart';
import '../data/product_model.dart';

final Provider<CatalogApi> catalogApiProvider = Provider<CatalogApi>(
  (Ref ref) => CatalogApi(ref.watch(dioProvider)),
);

final StateProvider<CatalogFilters> catalogFiltersProvider = StateProvider<CatalogFilters>(
  (Ref ref) => const CatalogFilters(),
);

final FutureProvider<List<Category>> categoriesProvider = FutureProvider<List<Category>>(
  (Ref ref) => ref.watch(catalogApiProvider).listCategories(),
);

final FutureProvider<List<Brand>> brandsProvider = FutureProvider<List<Brand>>(
  (Ref ref) => ref.watch(catalogApiProvider).listBrands(),
);

/// Paginated product list that accumulates pages as the grid is scrolled.
/// Rebuilds from scratch whenever the filters change.
final AsyncNotifierProvider<ProductListController, List<ProductSummary>> productListProvider =
    AsyncNotifierProvider<ProductListController, List<ProductSummary>>(ProductListController.new);

class ProductListController extends AsyncNotifier<List<ProductSummary>> {
  String? _nextCursor;
  bool _isLoadingMore = false;

  @override
  Future<List<ProductSummary>> build() async {
    final CatalogFilters filters = ref.watch(catalogFiltersProvider);
    final ProductPage page = await ref.watch(catalogApiProvider).listProducts(filters: filters);
    _nextCursor = page.nextCursor;
    return page.items;
  }

  bool get hasMore => _nextCursor != null;

  /// Appends the next page. No-op at the end of the list or while a fetch is
  /// already in flight — scroll listeners fire far faster than the network.
  Future<void> loadMore() async {
    if (_isLoadingMore || _nextCursor == null) return;
    final List<ProductSummary>? current = state.value;
    if (current == null) return;

    _isLoadingMore = true;
    try {
      final ProductPage page = await ref
          .read(catalogApiProvider)
          .listProducts(filters: ref.read(catalogFiltersProvider), cursor: _nextCursor);
      _nextCursor = page.nextCursor;
      state = AsyncData<List<ProductSummary>>(<ProductSummary>[...current, ...page.items]);
    } finally {
      _isLoadingMore = false;
    }
  }
}

final AsyncNotifierProvider<WishlistController, List<ProductSummary>> wishlistProvider =
    AsyncNotifierProvider<WishlistController, List<ProductSummary>>(WishlistController.new);

/// Fast O(1) lookup set of wishlisted product IDs for [ProductCard] and [PdpScreen].
final Provider<Set<String>> wishlistIdsProvider = Provider<Set<String>>((Ref ref) {
  final AsyncValue<List<ProductSummary>> wishlist = ref.watch(wishlistProvider);
  final List<ProductSummary>? items = wishlist.valueOrNull;
  if (items == null) return const <String>{};
  return items.map((ProductSummary p) => p.id).toSet();
});

class WishlistController extends AsyncNotifier<List<ProductSummary>> {
  @override
  Future<List<ProductSummary>> build() async {
    final bool isAuthenticated = ref.watch(
      authControllerProvider.select((AuthState s) => s.isAuthenticated),
    );
    if (!isAuthenticated) {
      return const <ProductSummary>[];
    }
    return ref.read(catalogApiProvider).listWishlist();
  }

  /// Toggles [productId] in the signed-in user's wishlist. Returns `true` if
  /// the item is now saved, or `false` if it was removed.
  Future<bool> toggle(String productId) async {
    final List<ProductSummary> current = state.valueOrNull ?? const <ProductSummary>[];
    final bool wasSaved = current.any((ProductSummary p) => p.id == productId);
    final CatalogApi api = ref.read(catalogApiProvider);
    final List<ProductSummary> updated = wasSaved
        ? await api.removeFromWishlist(productId)
        : await api.addToWishlist(productId);
    state = AsyncData<List<ProductSummary>>(updated);
    return !wasSaved;
  }
}
