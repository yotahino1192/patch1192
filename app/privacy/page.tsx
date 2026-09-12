import { PublicDocument } from '../public-pages/public-document';
import { publicPageMetadata } from '../public-pages/metadata';
export const metadata = publicPageMetadata('privacy');
export default function Page() { return <PublicDocument kind="privacy"/>; }
