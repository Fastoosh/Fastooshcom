// Work With Us page text — kept for the existing imports. The shared code
// for all editable pages lives in ./pageContent.
import { PAGES, pageFields, readPageCache, writePageCache, type PageOverrides } from './pageContent';

export {
  baseLang, hasValue, flattenForTranslation, unflattenTranslation,
  type PageLang as WwuLang, type PageStep as WwuStep, type PageValue as WwuValue,
  type PageOverrides as WwuOverrides, type PageField as WwuField, type PageGroup as WwuGroup,
} from './pageContent';

export const WWU_GROUPS = PAGES.workWithUs.groups;
export const WWU_FIELDS = pageFields(PAGES.workWithUs);
export const readCachedOverrides = () => readPageCache(PAGES.workWithUs);
export const writeCachedOverrides = (o: PageOverrides) => writePageCache(PAGES.workWithUs, o);
