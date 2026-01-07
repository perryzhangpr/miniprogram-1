const DEFAULT_SAFE_AREA_OFFSET = 15;
const COMPACT_SAFE_AREA_OFFSET = 10;
const NAV_BAR_HEIGHT = 44;

function calcSafeBottom(systemInfo, offset) {
  let safeB = systemInfo.safeArea
    ? (systemInfo.screenHeight - systemInfo.safeArea.bottom)
    : 0;

  if (safeB > 0) {
    safeB -= offset;
    if (safeB < 0) safeB = 0;
  }

  return safeB;
}

function getSafeArea(offset = DEFAULT_SAFE_AREA_OFFSET) {
  const systemInfo = wx.getSystemInfoSync();
  return calcSafeBottom(systemInfo, offset);
}

function getNavHeights({ offset = DEFAULT_SAFE_AREA_OFFSET } = {}) {
  const systemInfo = wx.getSystemInfoSync();
  return {
    navH: (systemInfo.statusBarHeight || 0) + NAV_BAR_HEIGHT,
    safeB: calcSafeBottom(systemInfo, offset)
  };
}

module.exports = {
  DEFAULT_SAFE_AREA_OFFSET,
  COMPACT_SAFE_AREA_OFFSET,
  getSafeArea,
  getNavHeights
};
