import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/product_model.dart';
import '../../domain/catalog_providers.dart';
import '../widgets/product_card.dart';

class WishlistScreen extends ConsumerWidget {
  const WishlistScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<ProductSummary>> wishlist =
        ref.watch(wishlistProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Wishlist')),
      body: wishlist.when(
        data: (List<ProductSummary> items) {
          if (items.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.containerMargin),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    const Icon(
                      Icons.favorite_border,
                      size: 48,
                      color: AppColors.onSurfaceVariant,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    const Text('Your wishlist is empty.'),
                    const SizedBox(height: AppSpacing.md),
                    OutlinedButton(
                      onPressed: () => context.go('/catalog'),
                      child: const Text('EXPLORE CATALOG'),
                    ),
                  ],
                ),
              ),
            );
          }
          return GridView.builder(
            padding: const EdgeInsets.all(AppSpacing.containerMargin),
            // Was `childAspectRatio: 0.62` — tighter still than the 0.58 that
            // clipped Home and Catalog, so this grid cut names worst of all.
            gridDelegate: ProductCard.gridDelegate(
              context,
              viewportWidth: MediaQuery.sizeOf(context).width,
            ),
            itemCount: items.length,
            itemBuilder: (BuildContext context, int index) {
              final ProductSummary product = items[index];
              return ProductCard(
                product: product,
                isWishlisted: true,
                onWishlistToggle: () =>
                    ref.read(wishlistProvider.notifier).toggle(product.id),
                // `push`, matching every other entry into the PDP. `go`
                // replaced the whole stack, so Back from a wishlist product
                // landed on the catalog grid instead of the wishlist.
                onTap: () => context.push('/catalog/product/${product.slug}'),
              );
            },
          );
        },
        error: (Object error, StackTrace stackTrace) =>
            Center(child: Text(friendlyErrorMessage(error))),
        loading: () => const Center(child: CircularProgressIndicator()),
      ),
    );
  }
}
