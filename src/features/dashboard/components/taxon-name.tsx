import { taxonNameParts } from '@/features/dashboard/utils/taxon-name-parts';

/**
 * A species label with its genus and species names in italics. One element,
 * so a grid or flex row treats the name as a single cell.
 */
export default function TaxonName({ name }: { name: string }) {
    return (
        <span>
            {taxonNameParts(name).map((part, index) =>
                part.italic ? <i key={index}>{part.text}</i> : part.text,
            )}
        </span>
    );
}
