import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/constants/domain_enums.dart';
import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/money.dart';
import '../../../auth/domain/auth_controller.dart';
import '../../../cart/domain/cart_controller.dart';
import '../../../catalog/domain/catalog_providers.dart';
import '../../data/pdp_api.dart';
import '../../domain/pdp_providers.dart';
import '../widgets/size_enquiry_sheet.dart';
import '../widgets/write_review_sheet.dart';

/// Keyed by product **slug** — the backend route is `/pdp/:slug`.
class PdpScreen extends ConsumerStatefulWidget {
  const PdpScreen({required this.slug, super.key});

  final String slug;

  @override
  ConsumerState<PdpScreen> createState() => _PdpScreenState();
}

class _PdpScreenState extends ConsumerState<PdpScreen> {
  int? _selectedSize;
  String? _selectedColour;

  @override
  Widget build(BuildContext context) {
    final AsyncValue<ProductDetail> product =
        ref.watch(productDetailProvider(widget.slug));

    return Scaffold(
      body: product.when(
        data: (ProductDetail detail) => _Body(
          detail: detail,
          selectedSize: _selectedSize,
          selectedColour: _selectedColour,
          onSizeChanged: (int? size) => setState(() => _selectedSize = size),
          onColourChanged: (String? colour) =>
              setState(() => _selectedColour = colour),
        ),
        error: (Object error, StackTrace stackTrace) =>
            Center(child: Text(friendlyErrorMessage(error))),
        loading: () => const Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({
    required this.detail,
    required this.selectedSize,
    required this.selectedColour,
    required this.onSizeChanged,
    required this.onColourChanged,
  });

  final ProductDetail detail;
  final int? selectedSize;
  final String? selectedColour;
  final ValueChanged<int?> onSizeChanged;
  final ValueChanged<String?> onColourChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String? effectiveColour = selectedColour ??
        (detail.availableColours.length == 1
            ? detail.availableColours.first
            : null);

    // The cart takes a variantId, never a productId.
    final bool needsSize = !detail.isFreeSize;
    final bool needsColour =
        detail.availableColours.length > 1 && effectiveColour == null;
    final ProductVariant? variant = (needsSize && selectedSize == null) ||
            needsColour
        ? null
        : detail.variantFor(size: selectedSize, colour: effectiveColour);
    final bool canAdd = variant != null && variant.inStock;
    final SizeChartRow? selectedChartRow =
        detail.sizeChart == null || selectedSize == null
            ? null
            : detail.sizeChart!.rows
                .where((SizeChartRow r) => r.nominalSize == selectedSize)
                .firstOrNull;

    final bool isSaved =
        ref.watch(wishlistIdsProvider).contains(detail.id);

    return CustomScrollView(
      slivers: <Widget>[
        SliverAppBar(
          expandedHeight: 440,
          pinned: true,
          actions: <Widget>[
            IconButton(
              tooltip: isSaved ? 'Remove from wishlist' : 'Save to wishlist',
              icon: Icon(
                isSaved ? Icons.favorite : Icons.favorite_border,
                color: isSaved ? AppColors.primary : null,
              ),
              onPressed: () async {
                final bool isAuthenticated =
                    ref.read(authControllerProvider).isAuthenticated;
                if (!isAuthenticated) {
                  context.push('/onboarding');
                  return;
                }
                try {
                  final bool nowSaved = await ref
                      .read(wishlistProvider.notifier)
                      .toggle(detail.id);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          nowSaved
                              ? 'Saved to wishlist'
                              : 'Removed from wishlist',
                        ),
                      ),
                    );
                  }
                } catch (error) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(friendlyErrorMessage(error))),
                    );
                  }
                }
              },
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            background: detail.officialMedia.isEmpty
                ? const ColoredBox(color: AppColors.surfaceContainer)
                : PageView(
                    children: detail.officialMedia
                        .map((MediaItem m) => CachedNetworkImage(
                              imageUrl: m.url,
                              fit: BoxFit.cover,
                              errorWidget:
                                  (BuildContext c, String u, Object e) =>
                                      const ColoredBox(
                                          color: AppColors.surfaceContainer),
                            ))
                        .toList(),
                  ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.all(AppSpacing.containerMargin),
          sliver: SliverList(
            delegate: SliverChildListDelegate(<Widget>[
              // The brand line used to sit here. Adorini does not present
              // garments by supplier, so the product name leads.
              Text(detail.name, style: AppTypography.headlineLgMobile),
              const SizedBox(height: AppSpacing.xs),
              Row(
                children: <Widget>[
                  Text(detail.pricePaise.asRupees,
                      style: AppTypography.priceDisplay),
                  if (detail.isDiscounted) ...<Widget>[
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      detail.compareAtPricePaise!.asRupees,
                      style: AppTypography.bodyMd.copyWith(
                        color: AppColors.onSurfaceVariant,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                  ],
                ],
              ),

              if (detail.reviewSummary.totalCount > 0) ...<Widget>[
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: <Widget>[
                    const Icon(Icons.star, size: 18),
                    const SizedBox(width: AppSpacing.xs),
                    Text(
                      '${detail.reviewSummary.averageRating?.toStringAsFixed(1) ?? '–'} '
                      '(${detail.reviewSummary.totalCount})',
                      style: AppTypography.bodyMd,
                    ),
                  ],
                ),
              ],

              // The fit signal that justifies the whole size-chart feature.
              if (detail.reviewSummary.dominantFitTag != null &&
                  detail.reviewSummary.dominantFitTag !=
                      FitTag.trueToSize) ...<Widget>[
                const SizedBox(height: AppSpacing.sm),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.tertiaryContainer,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Text(
                    'Most buyers say this ${detail.reviewSummary.dominantFitTag!.label.toLowerCase()}.',
                    style: AppTypography.bodyMd,
                  ),
                ),
              ],

              const SizedBox(height: AppSpacing.lg),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Text('Size', style: AppTypography.labelBold),
                  if (detail.sizeChart != null && !detail.isFreeSize)
                    TextButton.icon(
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      onPressed: () => _SizeChartSheet.show(
                        context,
                        chart: detail.sizeChart!,
                        selectedSize: selectedSize,
                      ),
                      icon: const Icon(Icons.straighten, size: 16),
                      label: const Text('Size chart'),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              if (detail.isFreeSize)
                Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer,
                      borderRadius: BorderRadius.circular(AppRadius.full),
                    ),
                    child: Text(
                      'Free Size (Fits standard adult range)',
                      style: AppTypography.bodyMdBold.copyWith(
                        color: AppColors.onPrimaryContainer,
                      ),
                    ),
                  ),
                )
              else ...<Widget>[
                Wrap(
                  spacing: AppSpacing.xs,
                  children: detail.availableSizes.map((int size) {
                    return ChoiceChip(
                      label: Text('$size'),
                      selected: selectedSize == size,
                      onSelected: (bool selected) =>
                          onSizeChanged(selected ? size : null),
                    );
                  }).toList(),
                ),
                if (selectedChartRow != null) ...<Widget>[
                  const SizedBox(height: AppSpacing.xs),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(
                        color: AppColors.outline.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Text(
                      selectedChartRow.fitAdvice,
                      style: AppTypography.bodyMd.copyWith(fontSize: 13),
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.xs),
                TextButton(
                  onPressed: () => showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    builder: (BuildContext context) =>
                        SizeEnquirySheet(slug: detail.slug),
                  ),
                  child: const Text('Need a size outside 40–46?'),
                ),
              ],

              if (detail.availableColours.length > 1) ...<Widget>[
                const SizedBox(height: AppSpacing.md),
                Text('Colour', style: AppTypography.labelBold),
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: AppSpacing.xs,
                  children: detail.availableColours.map((String colour) {
                    return ChoiceChip(
                      label: Text(colour),
                      selected: selectedColour == colour,
                      onSelected: (bool selected) =>
                          onColourChanged(selected ? colour : null),
                    );
                  }).toList(),
                ),
              ],

              if (detail.description != null) ...<Widget>[
                const SizedBox(height: AppSpacing.lg),
                Text(detail.description!, style: AppTypography.bodyMd),
              ],

              const SizedBox(height: AppSpacing.xl),
              ElevatedButton(
                onPressed: !canAdd
                    ? null
                    : () async {
                        await ref
                            .read(cartControllerProvider.notifier)
                            .addItem(variantId: variant.id);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: const Text('Added to cart'),
                              action: SnackBarAction(
                                label: 'VIEW CART',
                                onPressed: () => context.push('/cart'),
                              ),
                            ),
                          );
                        }
                      },
                child: Text(
                  needsSize && selectedSize == null
                      ? 'SELECT A SIZE'
                      : needsColour
                          ? 'SELECT A COLOUR'
                          : (canAdd ? 'ADD TO CART' : 'OUT OF STOCK'),
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              _ReviewsSection(detail: detail),
              const SizedBox(height: AppSpacing.xl),
            ]),
          ),
        ),
      ],
    );
  }
}

class _ReviewsSection extends ConsumerWidget {
  const _ReviewsSection({required this.detail});

  final ProductDetail detail;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<ReviewPage> reviewsAsync =
        ref.watch(productReviewsProvider(detail.slug));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const Divider(),
        const SizedBox(height: AppSpacing.sm),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: <Widget>[
            Text(
              'Reviews (${detail.reviewSummary.totalCount})',
              style: AppTypography.titleMd,
            ),
            TextButton.icon(
              onPressed: () async {
                final bool isAuthenticated =
                    ref.read(authControllerProvider).isAuthenticated;
                if (!isAuthenticated) {
                  context.push('/onboarding');
                  return;
                }
                final bool? submitted = await showModalBottomSheet<bool>(
                  context: context,
                  isScrollControlled: true,
                  builder: (BuildContext context) => WriteReviewSheet(
                    slug: detail.slug,
                    availableSizes: detail.availableSizes,
                    isFreeSize: detail.isFreeSize,
                  ),
                );
                if (submitted == true && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Review submitted')),
                  );
                }
              },
              icon: const Icon(Icons.rate_review_outlined, size: 16),
              label: const Text('Write a review'),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        reviewsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
            child: Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          ),
          error: (Object error, StackTrace stackTrace) => Text(
            friendlyErrorMessage(error),
            style: AppTypography.bodyMd.copyWith(
              color: AppColors.onSurfaceVariant,
            ),
          ),
          data: (ReviewPage page) {
            if (page.items.isEmpty) {
              return Text(
                'No reviews yet. Be the first to share how this piece fits.',
                style: AppTypography.bodyMd.copyWith(
                  color: AppColors.onSurfaceVariant,
                ),
              );
            }
            return Column(
              children: page.items.map((ReviewItem item) {
                return Container(
                  margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(
                      color: AppColors.outline.withValues(alpha: 0.16),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          for (int i = 0; i < 5; i++)
                            Icon(
                              i < item.rating ? Icons.star : Icons.star_border,
                              size: 16,
                              color: AppColors.primary,
                            ),
                          const SizedBox(width: AppSpacing.xs),
                          if (item.isVerifiedPurchase)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.primaryContainer,
                                borderRadius:
                                    BorderRadius.circular(AppRadius.full),
                              ),
                              child: Text(
                                'Verified buyer',
                                style: AppTypography.labelBold.copyWith(
                                  fontSize: 10,
                                  color: AppColors.onPrimaryContainer,
                                ),
                              ),
                            ),
                        ],
                      ),
                      if (item.fitTag != null ||
                          item.purchasedNominalSize != null) ...<Widget>[
                        const SizedBox(height: 4),
                        Text(
                          <String>[
                            if (item.purchasedNominalSize != null)
                              'Size ${item.purchasedNominalSize}',
                            if (item.fitTag != null) item.fitTag!.label,
                          ].join(' • '),
                          style: AppTypography.bodyMd.copyWith(
                            fontSize: 12,
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                      if (item.body != null && item.body!.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 6),
                        Text(item.body!, style: AppTypography.bodyMd),
                      ],
                      if (item.reviewerName != null) ...<Widget>[
                        const SizedBox(height: 4),
                        Text(
                          '— ${item.reviewerName}',
                          style: AppTypography.bodyMd.copyWith(
                            fontSize: 12,
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }
}

class _SizeChartSheet extends StatelessWidget {
  const _SizeChartSheet({required this.chart, this.selectedSize});

  final SizeChart chart;
  final int? selectedSize;

  static Future<void> show(
    BuildContext context, {
    required SizeChart chart,
    int? selectedSize,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
      ),
      builder: (BuildContext context) =>
          _SizeChartSheet(chart: chart, selectedSize: selectedSize),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.containerMargin),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                Text(
                  'Size Guide (${chart.stretches ? 'Stretch' : 'Non-Stretch'} Fabric)',
                  style: AppTypography.titleMd,
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              chart.measurementNote,
              style: AppTypography.bodyMd.copyWith(
                fontSize: 13,
                color: AppColors.onSurfaceVariant,
              ),
            ),
            if (chart.guidanceNote != null) ...<Widget>[
              const SizedBox(height: AppSpacing.xs),
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.primaryContainer,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Text(
                  chart.guidanceNote!,
                  style: AppTypography.bodyMd.copyWith(
                    fontSize: 13,
                    color: AppColors.onPrimaryContainer,
                  ),
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowHeight: 40,
                dataRowMinHeight: 38,
                dataRowMaxHeight: 44,
                columns: const <DataColumn>[
                  DataColumn(label: Text('Size')),
                  DataColumn(label: Text('Bust (cm)')),
                  DataColumn(label: Text('Waist (cm)')),
                  DataColumn(label: Text('Hip (cm)')),
                  DataColumn(label: Text('Length (cm)')),
                ],
                rows: chart.rows.map((SizeChartRow row) {
                  final bool isSelected = row.nominalSize == selectedSize;
                  return DataRow(
                    selected: isSelected,
                    cells: <DataCell>[
                      DataCell(
                        Text(
                          '${row.nominalSize}',
                          style: isSelected
                              ? AppTypography.bodyMdBold
                              : AppTypography.bodyMd,
                        ),
                      ),
                      DataCell(Text(row.bust.formatted)),
                      DataCell(Text(row.waist.formatted)),
                      DataCell(Text(row.hip.formatted)),
                      DataCell(Text('${row.garmentLengthCm}')),
                    ],
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ),
      ),
    );
  }
}
