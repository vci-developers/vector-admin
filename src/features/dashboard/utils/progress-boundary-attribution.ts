export type ProgressBoundarySource = {
    country: string;
    provider: string;
    sourceUrl: string;
    attribution: string;
    license: string;
    licenseUrl: string;
    derivativeDownloadUrl?: string;
};

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);

/** Leaflet credits link to the catalogue, original source and specific license. */
export function progressBoundaryAttribution(source: ProgressBoundarySource) {
    const catalogue = source.sourceUrl.startsWith(
        'https://www.geoboundaries.org/',
    )
        ? '<a href="https://www.geoboundaries.org/">geoBoundaries</a> · '
        : '';
    const credit = `${source.provider}; ${source.attribution}`;
    const label = source.sourceUrl.startsWith('https://adr.unaids.org/')
        ? `${source.country}: UNAIDS`
        : source.country;
    const original = `<a href="${escapeHtml(source.sourceUrl)}" title="${escapeHtml(credit)}">${escapeHtml(label)}</a>`;
    const license = `<a href="${escapeHtml(source.licenseUrl)}">${escapeHtml(source.license)}</a>`;
    const download = source.derivativeDownloadUrl
        ? `; <a href="${escapeHtml(source.derivativeDownloadUrl)}" download>boundary data</a>`
        : '';
    return `<span class="progress-map-credit"><span class="progress-map-credit-source">${catalogue}${original}</span> <span class="progress-map-credit-details">(${license}; simplified${download})</span></span>`;
}
