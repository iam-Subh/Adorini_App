import 'package:flutter/material.dart';

final RegExp _letter = RegExp(r'\p{L}', unicode: true);

/// Returns the first letter without using phone numbers or punctuation.
/// Keep combining marks with the letter for names in non-Latin scripts.
String profileInitial(String? name) {
  for (final String character in (name ?? '').characters) {
    if (_letter.hasMatch(character)) return character.toUpperCase();
  }
  return '';
}
