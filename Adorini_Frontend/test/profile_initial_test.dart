import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:adorini_frontend/features/account/domain/account_providers.dart';
import 'package:adorini_frontend/features/account/presentation/profile_initial.dart';
import 'package:adorini_frontend/features/account/presentation/screens/edit_profile_screen.dart';
import 'package:adorini_frontend/features/account/presentation/screens/profile_screen.dart';
import 'package:adorini_frontend/features/auth/data/auth_api.dart';
import 'package:adorini_frontend/features/checkout/data/checkout_api.dart';
import 'package:adorini_frontend/features/checkout/domain/checkout_providers.dart';

void main() {
  test('uses one uppercase letter and skips numbers and punctuation', () {
    expect(profileInitial('Subha Patra'), 'S');
    expect(profileInitial('  subha'), 'S');
    expect(profileInitial('123-subha'), 'S');
    expect(profileInitial(null), '');
    expect(profileInitial('   '), '');
    expect(profileInitial('+919856325536'), '');
    expect(profileInitial('১২৩'), '');
    expect(profileInitial('!?🙂'), '');
  });

  test('supports non-Latin letters and combining marks', () {
    expect(profileInitial('éva'), 'É');
    expect(profileInitial('e\u0301va'), 'E\u0301');
    expect(profileInitial('সুব্রত'), startsWith('স'));
  });

  const PublicUser user = PublicUser(
    id: 'profile-test',
    phone: '919856325536',
    isPhoneVerified: true,
    hasGoogleLinked: false,
  );

  Future<void> showScreen(WidgetTester tester, Widget screen) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          userProfileProvider.overrideWith((ref) async => user),
          addressListProvider.overrideWith((ref) async => <Address>[]),
        ],
        child: MaterialApp(home: screen),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('Edit Profile updates the initial for every name change',
      (WidgetTester tester) async {
    await showScreen(tester, const EditProfileScreen());
    final Finder avatar = find.byType(CircleAvatar);
    final Finder firstName = find.byType(TextFormField).first;

    expect(find.descendant(of: avatar, matching: find.text('9')), findsNothing);
    expect(
        find.descendant(
            of: avatar, matching: find.byIcon(Icons.person_outline)),
        findsOneWidget);

    for (final String name in <String>['Subh', 'Arun', '123', '', 'bina']) {
      await tester.enterText(firstName, name);
      await tester.pump();
      final String initial = profileInitial(name);
      expect(
        find.descendant(
          of: avatar,
          matching: initial.isEmpty
              ? find.byIcon(Icons.person_outline)
              : find.text(initial),
        ),
        findsOneWidget,
      );
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('Account does not use the phone number as an initial',
      (WidgetTester tester) async {
    await showScreen(tester, const ProfileScreen());
    final Finder avatar = find.byType(CircleAvatar);
    expect(find.descendant(of: avatar, matching: find.text('9')), findsNothing);
    expect(
        find.descendant(
            of: avatar, matching: find.byIcon(Icons.person_outline)),
        findsOneWidget);
  });
}
