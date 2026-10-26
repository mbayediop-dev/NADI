/** Typographie française : espaces insécables avant « : ; ! ? % » et à l'intérieur des guillemets. */
export function frenchText(text: string) {
  return text
    .replace(/ ([:;!?%»])/g, " $1")
    .replace(/« /g, "« ")
}
