import { describe, expect, it } from 'vitest';
import {
  cardHoverPreviewDialogClassName,
  cardHoverPreviewImageClassName,
  cardHoverPreviewLandscapeFrameClassName,
  cardHoverPreviewLandscapeImageClassName,
  cardImageLandscapeFrameClassName,
  cardThumbnailLayoutToken,
  faceTypeLineFromCard,
  frontFaceManaCost,
  frontFaceName,
  isBattleTypeLine,
  isDoubleSidedLayout,
  isLandscapeCardFace,
  isLandscapeCardLayout,
  isSingleSidedSplitLayout,
  needsImageRotation,
} from '@/lib/cardLayout';

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

  it('should_return_true_for_split_when_checking_isLandscapeCardLayout', () => {
    expect(isLandscapeCardLayout('split')).toBe(true);
  });

  it('should_return_false_for_flip_when_checking_isLandscapeCardLayout', () => {
    expect(isLandscapeCardLayout('flip')).toBe(false);
  });

  it('should_return_false_for_prepare_when_checking_isLandscapeCardLayout', () => {
    expect(isLandscapeCardLayout('prepare')).toBe(false);
  });

  it('should_return_false_for_adventure_when_checking_isLandscapeCardLayout', () => {
    expect(isLandscapeCardLayout('adventure')).toBe(false);
  });

  it('should_use_portrait_hover_preview_for_normal_cards', () => {
    expect(cardHoverPreviewImageClassName(null, 'desktop')).toContain('max-w-[360px]');
    expect(cardHoverPreviewImageClassName(null, 'touch')).toContain('max-w-[360px]');
  });

  it('should_use_wider_touch_dialog_for_landscape_cards', () => {
    expect(cardHoverPreviewDialogClassName(true)).toContain('max-w-2xl');
  });

  it('should_use_standard_touch_dialog_for_portrait_cards', () => {
    expect(cardHoverPreviewDialogClassName(false)).toContain('max-w-md');
  });

  it('should_use_full_width_touch_frame_for_landscape_hover_preview', () => {
    const touchFrame = cardHoverPreviewLandscapeFrameClassName('touch');
    expect(touchFrame).toContain('h-[min(55vh,400px)]');
    expect(touchFrame).toContain('w-full');
    expect(touchFrame).not.toContain('w-[min(92vw,660px)]');
    expect(touchFrame).not.toContain('shrink-0');
  });

  it('should_use_fixed_width_desktop_frame_for_landscape_hover_preview', () => {
    const desktopFrame = cardHoverPreviewLandscapeFrameClassName('desktop');
    expect(desktopFrame).toContain('h-[min(60vh,440px)]');
    expect(desktopFrame).toContain('w-[min(92vw,660px)]');
    expect(desktopFrame).toContain('shrink-0');
  });

  it('should_return_true_for_battle_siege_type_line_when_checking_isBattleTypeLine', () => {
    expect(isBattleTypeLine('Battle — Siege')).toBe(true);
  });

  it('should_return_false_for_creature_type_line_when_checking_isBattleTypeLine', () => {
    expect(isBattleTypeLine('Legendary Creature — Dinosaur')).toBe(false);
  });

  it('should_return_false_for_null_when_checking_isBattleTypeLine', () => {
    expect(isBattleTypeLine(null)).toBe(false);
  });

  it('should_return_true_for_battle_face_on_transform_when_checking_isLandscapeCardFace', () => {
    expect(isLandscapeCardFace('transform', 'Battle — Siege')).toBe(true);
  });

  it('should_return_false_for_creature_back_on_transform_when_checking_isLandscapeCardFace', () => {
    expect(isLandscapeCardFace('transform', 'Legendary Creature — Dinosaur')).toBe(false);
  });

  it('should_return_true_for_split_layout_when_checking_isLandscapeCardFace', () => {
    expect(isLandscapeCardFace('split', null)).toBe(true);
  });

  it('should_return_false_for_normal_creature_when_checking_isLandscapeCardFace', () => {
    expect(isLandscapeCardFace(null, 'Creature — Elf')).toBe(false);
  });

  it('should_split_combined_type_line_for_siege_front_face', () => {
    expect(faceTypeLineFromCard('Battle — Siege // Legendary Creature — Dinosaur', 0)).toBe(
      'Battle — Siege',
    );
    expect(faceTypeLineFromCard('Battle — Siege // Legendary Creature — Dinosaur', 1)).toBe(
      'Legendary Creature — Dinosaur',
    );
  });

  it('should_use_split_layout_token_for_siege_thumbnails', () => {
    expect(
      cardThumbnailLayoutToken('transform', 'Battle — Siege // Legendary Creature — Dinosaur'),
    ).toBe('split');
    expect(cardImageLandscapeFrameClassName()).toContain('aspect-[680/488]');
  });

  it('should_rotate_split_and_battle_faces_not_portrait_layouts', () => {
    expect(needsImageRotation('transform', 'Battle — Siege')).toBe(true);
    expect(needsImageRotation('split', 'Enchantment — Room')).toBe(true);
    expect(needsImageRotation('split', 'Fire // Ice')).toBe(true);
    expect(needsImageRotation('flip', null)).toBe(false);
    expect(needsImageRotation('prepare', null)).toBe(false);
    expect(needsImageRotation(null, 'Creature — Elf')).toBe(false);
    expect(cardHoverPreviewLandscapeImageClassName()).toContain('rotate-90');
    expect(cardHoverPreviewLandscapeImageClassName()).toContain('absolute');
  });
});
