import { describe, expect, it } from 'vitest';
import { frontFaceManaCost, frontFaceName, isDoubleSidedLayout, isSingleSidedSplitLayout } from '@/lib/cardLayout';

describe('cardLayout', () => {
  it('should_return_true_for_transform_when_checking_isDoubleSidedLayout', () => {
    expect(isDoubleSidedLayout('transform')).toBe(true);
  });

  it('should_return_true_for_modal_dfc_when_checking_isDoubleSidedLayout', () => {
    expect(isDoubleSidedLayout('modal_dfc')).toBe(true);
  });

  it('should_return_false_for_adventure_when_checking_isDoubleSidedLayout', () => {
    expect(isDoubleSidedLayout('adventure')).toBe(false);
  });

  it('should_return_false_for_null_when_checking_isDoubleSidedLayout', () => {
    expect(isDoubleSidedLayout(null)).toBe(false);
  });

  it('should_return_true_for_adventure_when_checking_isSingleSidedSplitLayout', () => {
    expect(isSingleSidedSplitLayout('adventure')).toBe(true);
  });

  it('should_return_true_for_prepare_when_checking_isSingleSidedSplitLayout', () => {
    expect(isSingleSidedSplitLayout('prepare')).toBe(true);
  });

  it('should_return_true_for_split_when_checking_isSingleSidedSplitLayout', () => {
    expect(isSingleSidedSplitLayout('split')).toBe(true);
  });

  it('should_return_false_for_transform_when_checking_isSingleSidedSplitLayout', () => {
    expect(isSingleSidedSplitLayout('transform')).toBe(false);
  });

  it('should_return_front_face_only_when_frontFaceName_given_adventure_layout', () => {
    expect(frontFaceName('Bonecrusher Giant // Stomp', 'adventure')).toBe('Bonecrusher Giant');
  });

  it('should_return_full_name_when_frontFaceName_given_transform_layout', () => {
    expect(frontFaceName('Delver of Secrets // Insectile Aberration', 'transform')).toBe(
      'Delver of Secrets // Insectile Aberration',
    );
  });

  it('should_return_full_name_when_frontFaceName_given_null_layout', () => {
    expect(frontFaceName('Joined Researchers // Secret Rendition', null)).toBe(
      'Joined Researchers // Secret Rendition',
    );
  });

  it('should_return_full_name_when_frontFaceName_given_name_without_separator', () => {
    expect(frontFaceName('Lightning Bolt', 'adventure')).toBe('Lightning Bolt');
  });

  it('should_return_front_face_only_when_frontFaceName_given_prepare_layout', () => {
    expect(frontFaceName('Joined Researchers // Secret Rendition', 'prepare')).toBe('Joined Researchers');
  });

  it('should_return_front_face_only_when_frontFaceManaCost_given_prepare_layout', () => {
    expect(frontFaceManaCost('{3}{U} // {1}{U}{U}', 'prepare')).toBe('{3}{U}');
  });

  it('should_return_full_cost_when_frontFaceManaCost_given_transform_layout', () => {
    expect(frontFaceManaCost('{U} // {2}{U}', 'transform')).toBe('{U} // {2}{U}');
  });

  it('should_return_original_cost_when_frontFaceManaCost_given_null_layout', () => {
    expect(frontFaceManaCost('{U} // {2}{U}', null)).toBe('{U} // {2}{U}');
  });
});

