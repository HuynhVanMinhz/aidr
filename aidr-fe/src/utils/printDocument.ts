/**
 * Print a document that lives outside (or is temporarily moved outside) #root.
 * Hides the app shell so Chrome does not emit blank multi-page output.
 */
export function runPrint(bodyClass: string): void {
  document.body.classList.add(bodyClass);

  const cleanup = () => {
    document.body.classList.remove(bodyClass);
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  window.requestAnimationFrame(() => {
    window.print();
  });
}

export function clearPrintClass(bodyClass: string): void {
  document.body.classList.remove(bodyClass);
}
