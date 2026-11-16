export function zipFilterValues(filter:string) {
  return filter.trim().split(/[\s,;]+/).filter(Boolean);
}
export function validZipFilter(filter:string) {
  return zipFilterValues(filter).every(value=>/^\d{5}(?:-\d{4})?$/.test(value));
}
export function matchesZipFilter(zip:string,filter:string) {
  const values=zipFilterValues(filter);
  if(!values.length)return true;
  if(!validZipFilter(filter))return false;
  const base=zip.trim().slice(0,5);
  return values.some(value=>value.slice(0,5)===base);
}
