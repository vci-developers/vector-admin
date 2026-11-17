/** Labels that name no genus or species, so stay upright. */
const NOT_TAXA = /^(non-mosquito|calibration specimens|other|unknown)$/i;
/** Words inside a name that aren't part of it: "Anopheles other", "sp.". */
const UPRIGHT_WORD =
    /^(other|others|unknown|sp\.?|spp\.?|\(.*\)|suspected\)?|\(suspected)$/i;

export type TaxonNamePart = { text: string; italic: boolean };

/**
 * Splits a species label so genus and species names can be italicised and
 * the rest ("other", "sp.", "(suspected)") left upright.
 */
export function taxonNameParts(name: string): TaxonNamePart[] {
    if (NOT_TAXA.test(name.trim())) return [{ text: name, italic: false }];
    const tokens = name.split(/(\s+)/).filter(token => token !== '');
    const isWord = (token?: string) =>
        token !== undefined && !/^\s+$/.test(token);
    const italicWord = (token?: string) =>
        isWord(token) && !UPRIGHT_WORD.test(token!);
    const parts: TaxonNamePart[] = [];
    tokens.forEach((token, index) => {
        // A space is italic only between two italic words.
        const italic = isWord(token)
            ? italicWord(token)
            : italicWord(tokens[index - 1]) && italicWord(tokens[index + 1]);
        const last = parts.at(-1);
        if (last?.italic === italic) last.text += token;
        else parts.push({ text: token, italic });
    });
    return parts;
}
