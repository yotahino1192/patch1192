import React from 'react';
import {createRoot} from 'react-dom/client';
import {LegalContent} from '../../app/legal-content';
createRoot(document.getElementById('root')).render(<><LegalContent kind="privacy"/><LegalContent kind="privacy"/></>);
