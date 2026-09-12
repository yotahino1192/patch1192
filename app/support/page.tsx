import { PublicDocument } from '../public-pages/public-document';
import { publicPageMetadata } from '../public-pages/metadata';
export const metadata = publicPageMetadata('support');
export default function Page() { return <PublicDocument kind="support"/>; }
