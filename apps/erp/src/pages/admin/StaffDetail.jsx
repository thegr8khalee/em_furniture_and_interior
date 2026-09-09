import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, ArrowLeft, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Modal, Select, SkeletonBlock } from '@em/ui';

/**
 * One operator, on a page of its own.
 *
 * "Why can this person do that?" is the question this screen exists to answer,
 * and the list could only ever show the role — not whether the permissions came
 * from it or from a grant somebody made by hand, and not what the person has
 * actually been doing with them.
 *
 * The audit trail is the second half of the answer. A permission is a claim
 * about what somebody could do; the trail is what they did.
 */

const moment = (value) =>
  value
    ? new Date(value).toLocaleString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

const Section = ({ title, icon: Icon, action, children }) => (
  <section className="border border-base-300 bg-white p-6">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral/60">
        {Icon && <Icon size={14} />}
        {title}
      </h2>
      {action}
    </div>
    {children}
  </section>
);

const StaffDetail = () => {
  const { staffId } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [staff, setStaff] = useState(null);
  const [roles, setRoles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [roleForm, setRoleForm] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const [one, list] = await Promise.all([
        axiosInstance.get(`/admin/staff/${staffId}`),
        // The roles a screen may offer come from the server rather than being
        // hard-coded here, so a new role does not need a frontend release.
        axiosInstance.get('/admin/staff').catch(() => null),
      ]);

      setStaff(one.data.staff);
      setRoles(list?.data?.roles ?? []);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load that operator');
      setStaff(null);
    } finally {
      setIsLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitRole = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      await axiosInstance.patch(`/admin/staff/${staffId}`, { role: roleForm.role });
      toast.success('Role changed.');
      setRoleForm(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not change that role');
    } finally {
      setIsSaving(false);
    }
  };

  const setActive = async (isActive) => {
    const verb = isActive ? 'let back in' : 'locked out';
    if (!window.confirm(`${staff.username} will be ${verb}. Continue?`)) return;

    setIsSaving(true);

    try {
      if (isActive) {
        await axiosInstance.patch(`/admin/staff/${staffId}`, { isActive: true });
      } else {
        await axiosInstance.post(`/admin/staff/${staffId}/deactivate`);
      }

      toast.success(isActive ? 'Access restored.' : 'Access withdrawn.');
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'That did not work');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminPageShell title="Loading…">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((index) => (
            <SkeletonBlock key={index} className="h-24 w-full" />
          ))}
        </div>
        <SkeletonBlock className="h-80 w-full" />
      </AdminPageShell>
    );
  }

  if (!staff) {
    return (
      <AdminPageShell title="Operator not found">
        <EmptyState
          icon={ShieldCheck}
          title="No operator with that id"
          description="They may have been removed, or the link may be wrong."
          actionLabel="Back to operators"
          actionTo="/admin/staff"
        />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title={staff.username}
      subtitle={staff.email}
      actions={
        <>
          <Button variant="ghost" leftIcon={ArrowLeft} to="/admin/staff">
            All operators
          </Button>
          <Button
            variant="secondary"
            leftIcon={KeyRound}
            onClick={() => setRoleForm({ role: staff.adminRole })}
          >
            Change role
          </Button>
          {staff.isActive ? (
            <Button
              variant="ghost"
              leftIcon={ShieldOff}
              className="text-error"
              onClick={() => setActive(false)}
              isLoading={isSaving}
            >
              Withdraw access
            </Button>
          ) : (
            <Button leftIcon={ShieldCheck} onClick={() => setActive(true)} isLoading={isSaving}>
              Restore access
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="border border-base-300 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">Role</p>
          <p className="mt-2 font-heading text-xl font-bold text-neutral">{staff.adminRole}</p>
        </div>
        <div className="border border-base-300 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">
            Access
          </p>
          <div className="mt-2">
            <Badge variant={staff.isActive ? 'success' : 'error'}>
              {staff.isActive ? 'active' : 'withdrawn'}
            </Badge>
          </div>
        </div>
        <div className="border border-base-300 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">
            Signs in with
          </p>
          <p className="mt-2 font-heading text-xl font-bold text-neutral">{staff.signsInWith}</p>
        </div>
        <div className="border border-base-300 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/50">
            Last seen
          </p>
          <p className="mt-2 text-sm font-medium text-neutral">{moment(staff.lastLoginAt)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* A permission is a claim about what somebody could do. This is what
              they did. */}
          <Section title="What they have been doing" icon={Activity}>
            {staff.recentActivity.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Nothing recorded"
                description="An audit entry is written whenever an operator changes something. This account has not changed anything yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Did what</th>
                      <th>To what</th>
                      <th>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.recentActivity.map((entry, index) => (
                      <tr key={index}>
                        <td className="whitespace-nowrap text-sm">{moment(entry.at)}</td>
                        <td className="text-sm">{entry.action}</td>
                        <td className="text-sm text-neutral/60">
                          {entry.resourceName || entry.resourceType}
                        </td>
                        <td>
                          <Badge variant={entry.outcome === 'SUCCESS' ? 'success' : 'error'}>
                            {entry.outcome}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="What they can do" icon={ShieldCheck}>
            {staff.hasExplicitPermissions && (
              <p className="mb-3 border border-warning/30 bg-warning/5 p-3 text-xs text-neutral/70">
                These were granted by hand and override the role. That is why they may not match
                what {staff.adminRole} normally gets.
              </p>
            )}

            <ul className="space-y-1">
              {staff.permissions.map((permission) => (
                <li key={permission} className="font-mono text-xs text-neutral/70">
                  {permission}
                </li>
              ))}
            </ul>

            {staff.permissions.length === 0 && (
              <p className="text-sm text-neutral/40">
                Nothing. They can sign in and see no screen at all.
              </p>
            )}
          </Section>

          <Section title="Account">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">Added</dt>
                <dd>{moment(staff.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral/40">
                  Recorded actions
                </dt>
                <dd>{staff.actionCount ?? staff.recentActivity.length}</dd>
              </div>
            </dl>
          </Section>
        </div>
      </div>

      <Modal isOpen={Boolean(roleForm)} onClose={() => setRoleForm(null)} title="Change role">
        {roleForm && (
          <form onSubmit={submitRole} className="space-y-4">
            <p className="text-sm text-neutral/60">
              A role is a set of permissions. Demoting the last owner is refused by the server —
              locking everybody out of the console is not a thing this screen can do by accident.
            </p>

            <Select
              label="Role"
              value={roleForm.role}
              onChange={(event) => setRoleForm({ role: event.target.value })}
            >
              {(roles.length ? roles : [{ value: staff.adminRole }]).map((role) => (
                <option key={role.value} value={role.value}>
                  {role.value}
                </option>
              ))}
            </Select>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setRoleForm(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSaving}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </AdminPageShell>
  );
};

export default StaffDetail;
