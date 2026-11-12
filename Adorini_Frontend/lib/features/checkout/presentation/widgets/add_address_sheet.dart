import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/checkout_api.dart';
import '../../domain/checkout_providers.dart';

/// Modal bottom sheet to create and save a new delivery address.
class AddAddressSheet extends ConsumerStatefulWidget {
  const AddAddressSheet({
    super.key,
    this.initialPhone,
    this.initialName,
  });

  final String? initialPhone;
  final String? initialName;

  /// Convenience helper to open the sheet.
  static Future<Address?> show(
    BuildContext context, {
    String? initialPhone,
    String? initialName,
  }) {
    return showModalBottomSheet<Address>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext ctx) => AddAddressSheet(
        initialPhone: initialPhone,
        initialName: initialName,
      ),
    );
  }

  @override
  ConsumerState<AddAddressSheet> createState() => _AddAddressSheetState();
}

class _AddAddressSheetState extends ConsumerState<AddAddressSheet> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  final TextEditingController _pincodeController = TextEditingController();
  final TextEditingController _line1Controller = TextEditingController();
  final TextEditingController _line2Controller = TextEditingController();
  final TextEditingController _cityController = TextEditingController();
  final TextEditingController _stateController = TextEditingController();

  bool _isDefault = true;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.initialName ?? '');
    _phoneController = TextEditingController(
      text: widget.initialPhone?.replaceAll(RegExp(r'^\+91|^91'), '') ?? '',
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _pincodeController.dispose();
    _line1Controller.dispose();
    _line2Controller.dispose();
    _cityController.dispose();
    _stateController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final String phone = _phoneController.text.trim();
      final String normalisedPhone = phone.startsWith('91') && phone.length == 12
          ? phone
          : '91$phone';

      final Address newAddress = await ref.read(checkoutApiProvider).createAddress(
            recipientName: _nameController.text.trim(),
            recipientPhone: normalisedPhone,
            line1: _line1Controller.text.trim(),
            line2: _line2Controller.text.trim().isEmpty ? null : _line2Controller.text.trim(),
            city: _cityController.text.trim(),
            state: _stateController.text.trim(),
            pincode: _pincodeController.text.trim(),
            isDefault: _isDefault,
          );

      // Refresh address list across the app
      ref.invalidate(addressListProvider);

      if (mounted) {
        Navigator.of(context).pop(newAddress);
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() => _errorMessage = apiErrorMessage(e));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = 'Failed to save address. Please try again.');
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final MediaQueryData mediaQuery = MediaQuery.of(context);
    final double bottomInset = mediaQuery.viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
      ),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.containerMargin,
        AppSpacing.md,
        AppSpacing.containerMargin,
        bottomInset + AppSpacing.containerMargin,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
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
                  Text('Add Delivery Address', style: AppTypography.titleMd),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              if (_errorMessage != null) ...<Widget>[
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.errorContainer.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: AppTypography.bodyMd.copyWith(color: AppColors.error, fontSize: 13),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              TextFormField(
                controller: _nameController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Recipient Full Name *',
                  hintText: 'e.g. Priya Sharma',
                  prefixIcon: Icon(Icons.person_outline),
                ),
                validator: (String? val) {
                  if (val == null || val.trim().isEmpty) return 'Please enter recipient name';
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                inputFormatters: <TextInputFormatter>[
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(10),
                ],
                decoration: const InputDecoration(
                  labelText: 'Mobile Number *',
                  hintText: '9876543210',
                  prefixText: '+91 ',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
                validator: (String? val) {
                  if (val == null || val.trim().isEmpty) return 'Please enter mobile number';
                  if (val.trim().length != 10) return 'Must be a 10-digit mobile number';
                  if (!RegExp(r'^[6-9]').hasMatch(val.trim())) {
                    return 'Must start with 6, 7, 8, or 9';
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: <Widget>[
                  Expanded(
                    child: TextFormField(
                      controller: _pincodeController,
                      keyboardType: TextInputType.number,
                      inputFormatters: <TextInputFormatter>[
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(6),
                      ],
                      decoration: const InputDecoration(
                        labelText: 'PIN Code *',
                        hintText: 'e.g. 700001',
                        prefixIcon: Icon(Icons.pin_drop_outlined),
                      ),
                      validator: (String? val) {
                        if (val == null || val.trim().isEmpty) return 'Enter PIN code';
                        if (!RegExp(r'^[1-9][0-9]{5}$').hasMatch(val.trim())) {
                          return 'Valid 6-digit PIN';
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: TextFormField(
                      controller: _cityController,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(
                        labelText: 'City *',
                        hintText: 'e.g. Kolkata',
                      ),
                      validator: (String? val) {
                        if (val == null || val.trim().isEmpty) return 'Enter city';
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _stateController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'State *',
                  hintText: 'e.g. West Bengal',
                  prefixIcon: Icon(Icons.map_outlined),
                ),
                validator: (String? val) {
                  if (val == null || val.trim().isEmpty) return 'Please enter state';
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _line1Controller,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'House / Flat / Street Address *',
                  hintText: 'e.g. 42B Park Street, Flat 3A',
                  prefixIcon: Icon(Icons.home_outlined),
                ),
                validator: (String? val) {
                  if (val == null || val.trim().isEmpty) return 'Please enter address';
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _line2Controller,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Area / Landmark (Optional)',
                  hintText: 'e.g. Near St. Xavier\'s College',
                  prefixIcon: Icon(Icons.location_city_outlined),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _isDefault,
                onChanged: (bool? val) => setState(() => _isDefault = val ?? true),
                title: Text('Make this my default address', style: AppTypography.bodyMd),
                controlAffinity: ListTileControlAffinity.leading,
              ),
              const SizedBox(height: AppSpacing.md),
              ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.button),
                  ),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text('SAVE ADDRESS', style: AppTypography.labelBold.copyWith(color: Colors.white)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
