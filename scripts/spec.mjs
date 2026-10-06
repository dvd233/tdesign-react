// Shared immutable contract: both source builds execute these exact same scenarios.
export const ALL = [1, 2, 3, 4, 5, 6];
export const SCENARIOS = [false, true].flatMap(reserve => [1, 2].map(initialPage => ({
  id: `reserve-${reserve}-initial-${initialPage}`, reserve, initialPage,
})));
export const visibleRows = page => [2 * page - 1, 2 * page];
export function stepsFor({ reserve, initialPage }) {
  const other = initialPage === 1 ? 2 : 1;
  const check = (id, page) => ({ id, action: 'toggle', page, selected: reserve ? ALL : visibleRows(page), type: 'check', currentRowKey: 'CHECK_ALL_BOX' });
  const clear = (id, page) => ({ id, action: 'toggle', page, selected: [], type: 'uncheck', currentRowKey: 'CHECK_ALL_BOX' });
  const paginate = (id, page) => ({ id, action: 'paginate', page, selected: reserve ? ALL : [], type: reserve ? null : 'uncheck', currentRowKey: reserve ? null : 'CLEAR_ON_PAGINATE' });
  return [
    check('initial-select', initialPage),
    clear('initial-unselect', initialPage),
    check('initial-reselect', initialPage),
    paginate('navigate-other', other),
    ...(reserve ? [clear('other-clear-retained', other)] : []),
    check('other-select', other),
    clear('other-unselect', other),
    check('other-reselect', other),
    paginate('navigate-back', initialPage),
    ...(reserve ? [clear('return-clear-retained', initialPage)] : []),
    check('return-select', initialPage),
    clear('return-unselect', initialPage),
  ];
}
