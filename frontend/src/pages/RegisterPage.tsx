// input:  [router redirect primitives]
// output: [`RegisterPage` compatibility route component]
// pos:    [Legacy sign-up route that immediately folds into the unified public auth entry so older links still work without exposing a second auth homepage]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { Navigate } from 'react-router-dom';

export const RegisterPage: React.FC = () => <Navigate to="/login" replace />;
