import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../checkout/data/checkout_api.dart';
import '../../../checkout/domain/checkout_providers.dart';
import '../../../checkout/presentation/widgets/add_address_sheet.dart';

/// Bottom sheet displaying saved delivery addresses with an option to add new ones.
class SavedAddressesSheet extends ConsumerWidget {
  const SavedAddressesSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext ctx) => const SavedAddressesSheet(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Address>> addresses = ref.watch(addressListProvider);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.8,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
      ),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.containerMargin,
        AppSpacing.md,
        AppSpacing.containerMargin,
        AppSpacing.containerMargin,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.outline.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(AppRadius.full),
              ),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text('Saved Addresses', style: AppTypography.titleMd),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Expanded(
            child: addresses.when(
              data: (List<Address> items) {
                if (items.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: <Widget>[
                          const Icon(
                            Icons.location_on_outlined,
                            size: 48,
                            color: AppColors.onSurfaceVariant,
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text('No saved addresses yet', style: AppTypography.bodyLgBold),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            'Add an address for a faster checkout experience.',
                            style: AppTypography.bodyMd.copyWith(color: AppColors.onSurfaceVariant, fontSize: 13),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  );
                }
                return ListView.separated(
                  shrinkWrap: true,
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (BuildContext ctx, int index) {
                    final Address address = items[index];
                    return Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceContainerLowest,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        border: Border.all(color: AppColors.outline.withValues(alpha: 0.15)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: <Widget>[
                              Text(
                                address.recipientName,
                                style: AppTypography.bodyMdBold,
                              ),
                              if (address.isDefault)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryContainer,
                                    borderRadius: BorderRadius.circular(AppRadius.sm),
                                  ),
                                  child: Text(
                                    'DEFAULT',
                                    style: AppTypography.bodyMd.copyWith(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.onPrimaryContainer,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(address.formatted, style: AppTypography.bodyMd.copyWith(fontSize: 14)),
                          const SizedBox(height: 4),
                          Text(
                            'Phone: +${address.recipientPhone}',
                            style: AppTypography.bodyMd.copyWith(color: AppColors.onSurfaceVariant, fontSize: 13),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
              error: (Object e, StackTrace s) => Center(
                child: Text('Failed to load addresses: $e', style: AppTypography.bodyMd.copyWith(color: AppColors.error)),
              ),
              loading: () => const Center(child: CircularProgressIndicator()),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          ElevatedButton.icon(
            icon: const Icon(Icons.add),
            label: Text('ADD NEW ADDRESS', style: AppTypography.labelBold.copyWith(color: Colors.white)),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.button),
              ),
            ),
            onPressed: () => AddAddressSheet.show(context),
          ),
        ],
      ),
    );
  }
}
