'use client';

import { motion } from 'framer-motion';

import { NeuCard } from '@unified/design-system';
import { stagger } from '@unified/motion';

import { useAuth } from '@/lib/auth-store.js';

/**
 * Phase 1.5 stub dashboard. KPI tiles + module dashboards land in Phase 5.
 */
export default function DashboardPage() {
  const { user, permissions } = useAuth();
  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl font-semibold">
        Welcome{user?.firstName ? `, ${user.firstName}` : ''}
      </h1>
      <p className="mt-1 text-text-secondary">
        Phase 1 ships identity + RBAC. Operational dashboards arrive in Phase 5.
      </p>

      <motion.div
        variants={stagger.container}
        initial="initial"
        animate="animate"
        className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        <motion.div variants={stagger.item}>
          <NeuCard>
            <h2 className="text-lg font-semibold">Your roles</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {permissions?.roles.length ? permissions.roles.join(', ') : 'No roles assigned'}
            </p>
          </NeuCard>
        </motion.div>
        <motion.div variants={stagger.item}>
          <NeuCard>
            <h2 className="text-lg font-semibold">Permissions</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {permissions?.isSuperAdmin
                ? 'Wildcard (super_admin)'
                : `${permissions?.permissions.length ?? 0} permissions granted`}
            </p>
          </NeuCard>
        </motion.div>
        <motion.div variants={stagger.item}>
          <NeuCard>
            <h2 className="text-lg font-semibold">Phase status</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Phase 1 ✓ — Identity + RBAC live. Phase 2 next: Social Hub.
            </p>
          </NeuCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
