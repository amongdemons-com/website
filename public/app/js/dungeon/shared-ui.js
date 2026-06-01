export const renderSharedDemonCard = window.AmongDemons.ui.renderDemonCard;
export const renderSharedCombatStats = window.AmongDemons.ui.renderCombatStats;
export const openDemonDetailsModal = window.AmongDemons.ui.openDemonDetailsModal;
export const renderIcon = window.AmongDemons.ui.renderIcon || (() => '');
export const renderSoulAmount = window.AmongDemons.ui.renderSoulAmount || ((value) => String(value || 0));
export const getRarityColor = window.AmongDemons.ui.getRarityColor || (() => '#D1D5D8');
