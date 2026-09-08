const domainPattern =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

export function isValidDomain(domain: string) {
  return domain.length <= 253 && domainPattern.test(domain);
}

const selectorLabelPattern =
  /^[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?$/;

export function isValidDkimSelector(selector: string) {
  if (selector.length > 253) {
    return false;
  }

  return selector.split(".").every(
    (label) => label.length <= 63 && selectorLabelPattern.test(label),
  );
}

export function isValidDkimRecordName(domain: string, selector: string) {
  return (
    isValidDkimSelector(selector) &&
    `${selector}._domainkey.${domain}`.length <= 253
  );
}
