import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/domain_enums.dart';
import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/pdp_providers.dart';

class WriteReviewSheet extends ConsumerStatefulWidget {
  const WriteReviewSheet({
    required this.slug,
    required this.availableSizes,
    required this.isFreeSize,
    super.key,
  });

  final String slug;
  final List<int> availableSizes;
  final bool isFreeSize;

  @override
  ConsumerState<WriteReviewSheet> createState() => _WriteReviewSheetState();
}

class _WriteReviewSheetState extends ConsumerState<WriteReviewSheet> {
  int _rating = 5;
  FitTag? _fitTag = FitTag.trueToSize;
  int? _purchasedSize;
  final TextEditingController _bodyController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await ref.read(pdpApiProvider).createReview(
            slug: widget.slug,
            rating: _rating,
            body: _bodyController.text.trim(),
            fitTag: _fitTag,
            purchasedNominalSize: widget.isFreeSize ? null : _purchasedSize,
          );
      ref.invalidate(productDetailProvider(widget.slug));
      ref.invalidate(productReviewsProvider(widget.slug));
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() => _error = apiErrorMessage(e));
      }
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.containerMargin,
          right: AppSpacing.containerMargin,
          top: AppSpacing.containerMargin,
          bottom: MediaQuery.of(context).viewInsets.bottom +
              AppSpacing.containerMargin,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Text('Write a review', style: AppTypography.titleMd),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text('Rating', style: AppTypography.labelBold),
              Row(
                children: List<Widget>.generate(5, (int index) {
                  final int starValue = index + 1;
                  return IconButton(
                    onPressed: () => setState(() => _rating = starValue),
                    icon: Icon(
                      starValue <= _rating ? Icons.star : Icons.star_border,
                      color: AppColors.primary,
                      size: 28,
                    ),
                  );
                }),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text('How did it fit?', style: AppTypography.labelBold),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.xs,
                children: FitTag.values.map((FitTag tag) {
                  return ChoiceChip(
                    label: Text(tag.label),
                    selected: _fitTag == tag,
                    onSelected: (bool selected) =>
                        setState(() => _fitTag = selected ? tag : null),
                  );
                }).toList(),
              ),
              if (!widget.isFreeSize &&
                  widget.availableSizes.isNotEmpty) ...<Widget>[
                const SizedBox(height: AppSpacing.sm),
                Text('Size purchased (optional)',
                    style: AppTypography.labelBold),
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: AppSpacing.xs,
                  children: widget.availableSizes.map((int size) {
                    return ChoiceChip(
                      label: Text('$size'),
                      selected: _purchasedSize == size,
                      onSelected: (bool selected) => setState(
                          () => _purchasedSize = selected ? size : null),
                    );
                  }).toList(),
                ),
              ],
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: _bodyController,
                maxLines: 3,
                maxLength: 2000,
                decoration: const InputDecoration(
                  labelText: 'Your review (optional)',
                  hintText: 'Share how the fabric, craft, and fit felt…',
                ),
              ),
              if (_error != null) ...<Widget>[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              ElevatedButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? 'SUBMITTING…' : 'SUBMIT REVIEW'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

