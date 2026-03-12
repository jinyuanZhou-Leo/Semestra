// input:  [course color utility helpers and Vitest assertions]
// output: [unit tests for subject-code parsing and automatic/default course color resolution]
// pos:    [Pure utility regression tests covering Program subject-color fallback behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { describe, expect, it } from 'vitest';
import {
  getAutomaticSubjectColor,
  parseSubjectColorMap,
  resolveSubjectColorAssignments,
  resolveCourseColor,
  resolveCourseSubjectCode,
  serializeSubjectColorMap,
} from '../courseCategoryBadge';

describe('courseCategoryBadge utilities', () => {
  it('resolves subject code from category before alias or name', () => {
    expect(resolveCourseSubjectCode({
      category: 'aps',
      alias: 'MAT180',
      name: 'ECE244H1',
    })).toBe('APS');
  });

  it('extracts subject code from alias or name when category is missing', () => {
    expect(resolveCourseSubjectCode({
      alias: 'MAT180H1',
      name: 'Calculus',
    })).toBe('MAT');

    expect(resolveCourseSubjectCode({
      alias: '',
      name: 'APS105 Introduction to Engineering Strategies and Practice',
    })).toBe('APS');
  });

  it('normalizes a valid subject color map and drops invalid entries', () => {
    expect(parseSubjectColorMap('{"aps":"#2563eb","bad":"blue","123":"#ff0000"}')).toEqual({
      APS: '#2563eb',
    });
  });

  it('serializes subject color maps in stable key order', () => {
    expect(serializeSubjectColorMap({
      MAT: '#16a34a',
      APS: '#2563eb',
    })).toBe('{"APS":"#2563eb","MAT":"#16a34a"}');
  });

  it('prefers course override color over Program subject colors', () => {
    expect(resolveCourseColor(
      {
        category: 'APS',
        alias: 'APS105',
        name: 'Engineering',
        color: '#111111',
      },
      { APS: '#2563eb' },
    )).toBe('#111111');
  });

  it('uses Program subject colors and then automatic colors when override is absent', () => {
    expect(resolveCourseColor(
      {
        category: 'APS',
        alias: 'APS105',
        name: 'Engineering',
        color: null,
      },
      { APS: '#2563eb' },
    )).toBe('#2563eb');

    expect(resolveCourseColor(
      {
        category: 'MAT',
        alias: 'MAT180',
        name: 'Calculus',
        color: null,
      },
      {},
    )).toBe(getAutomaticSubjectColor('MAT'));
  });

  it('avoids occupied palette colors when another automatic color is available', () => {
    const preferredColor = getAutomaticSubjectColor('APS');
    const reassignedColor = getAutomaticSubjectColor('APS', [preferredColor]);

    expect(reassignedColor).not.toBe(preferredColor);
    expect(reassignedColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('assigns distinct automatic colors across a visible subject-code set', () => {
    const resolved = resolveSubjectColorAssignments(['APS', 'MAT', 'CSC'], {});
    const colors = Object.values(resolved);

    expect(new Set(colors).size).toBe(colors.length);
  });

  it('keeps existing automatic assignments stable when a new code is added', () => {
    const initialResolved = resolveSubjectColorAssignments(['APS', 'MAT'], {});
    const nextResolved = resolveSubjectColorAssignments(['APS', 'MAT', 'CSC'], {}, initialResolved);

    expect(nextResolved.APS).toBe(initialResolved.APS);
    expect(nextResolved.MAT).toBe(initialResolved.MAT);
  });

  it('reserves persisted hidden assignments so a new visible code does not steal that color', () => {
    const reservedAssignments = {
      AAA: getAutomaticSubjectColor('AAA'),
    };
    const nextResolved = resolveSubjectColorAssignments(['AAM'], {}, reservedAssignments);

    expect(nextResolved.AAM).not.toBe(reservedAssignments.AAA);
  });
});
