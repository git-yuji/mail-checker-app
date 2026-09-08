const domainPattern =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

export function isValidDomain(domain: string) {
  return domain.length <= 253 && domainPattern.test(domain);
}

const selectorPattern = /^[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?$/;

export function isValidDkimSelector(selector: string) {
  return selector.length <= 63 && selectorPattern.test(selector);
}
