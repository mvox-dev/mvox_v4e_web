import { clearAll } from '../../../lib/auth/storage';
import { userStore } from '../../../lib/auth/userStore';

export function performLogout(): void {
	clearAll({ preserveProvider: false });
	userStore.set({ status: 'signed-out' });
}
