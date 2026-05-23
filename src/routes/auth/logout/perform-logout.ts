import { clearAll } from '../../../lib/auth/storage';

export function performLogout(): void {
	clearAll({ preserveProvider: false });
}
