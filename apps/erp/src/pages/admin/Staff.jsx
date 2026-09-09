import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '@em/domain';
import { toast } from 'react-hot-toast';
import AdminPageShell from '../../components/admin/AdminPageShell';
import { Badge, Button, EmptyState, Input, Modal, Select, SkeletonBlock } from '@em/ui';

/**
 * Who can get into the console.
 *
 * `POST /api/admin/signup` could create an operator and nothing could list one,
 * so there was no way to see who had access or take it away without writing
 * SQL — while `staff.manage` existed as a permission with nothing behind it.
 *
 * The refusals are the substance of this screen, and they come from the API
 * rather than from the buttons being hidden: nobody changes their own role or
 * stands themselves down, and the last active owner cannot be stood down at
 * all. Both are one click away from a console nobody can get back into.
 */

const day = (value) => (value ? new Date(value).toLocaleDateString('en-NG') : 'never');

const ROLE_COLOURS = {
  super_admin: 'primary',
  admin: 'secondary',
  editor: 'info',
  support: 'neutral',
  social_media_manager: 'neutral',
};

const readable = (value) => String(value).replace(/[._]/g, ' ');

const Staff = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [me, setMe] = useState(null);

  const [editing, setEditing] = useState(null);
  const [inviting, setInviting] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await axiosInstance.get('/admin/staff');
      setStaff(data.staff);
      setRoles(data.roles);
      setPermissions(data.permissions);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not load operators');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Who I am, so the screen can say "you" and explain why some controls are
    // absent — rather than offering a button the API will refuse.
    axiosInstance
      .get('/auth/check')
      .then(({ data }) => setMe(data))
      .catch(() => {});
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { data } = await axiosInstance.patch(`/admin/staff/${editing._id}`, {
        username: editing.username,
        role: editing.adminRole,
        permissions: editing.explicitPermissions,
      });
      toast.success(data.message);
      setEditing(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not save that');
    } finally {
      setIsSaving(false);
    }
  };

  const invite = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      await axiosInstance.post('/admin/signup', inviting);
      toast.success(`${inviting.username} can now sign in.`);
      setInviting(null);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not create that operator');
    } finally {
      setIsSaving(false);
    }
  };

  const setActive = async (operator, isActive) => {
    const verb = isActive ? 'Restore' : 'Remove';
    if (!window.confirm(`${verb} access for ${operator.username}?`)) return;

    try {
      const { data } = isActive
        ? await axiosInstance.patch(`/admin/staff/${operator._id}`, { isActive: true })
        : await axiosInstance.post(`/admin/staff/${operator._id}/deactivate`);
      toast.success(data.message);
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Could not change that');
    }
  };

  const togglePermission = (permission) =>
    setEditing((current) => {
      const held = current.explicitPermissions.includes(permission);
      return {
        ...current,
        explicitPermissions: held
          ? current.explicitPermissions.filter((p) => p !== permission)
          : [...current.explicitPermissions, permission],
      };
    });

  const roleDefaults = (role) => roles.find((r) => r.value === role)?.permissions ?? [];

  return (
    <AdminPageShell
      title="Operators"
      subtitle="Who can sign in to this console, and what each of them may do"
      actions={
        <Button
          variant="primary"
          leftIcon={UserPlus}
          onClick={() =>
            setInviting({ username: '', email: '', password: '', role: 'support' })
          }
        >
          Add an operator
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <SkeletonBlock key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No operators"
          description="Somebody is signed in reading this, so there is at least one account — which means this list failed to load rather than being genuinely empty."
          actionLabel="Try again"
          onAction={load}
        />
      ) : (
        <div className="border border-base-300 bg-white">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Signs in</th>
                  <th>Last seen</th>
                  <th className="text-right">Actions logged</th>
                  <th>Status</th>
                  <th className="text-right" />
                </tr>
              </thead>
              <tbody>
                {staff.map((operator) => {
                  const isMe = me?._id === operator._id;

                  return (
                    <tr
                      key={operator._id}
                      className={`cursor-pointer ${operator.isActive ? 'hover' : 'opacity-60'}`}
                      onClick={() => navigate(`/admin/staff/${operator._id}`)}
                    >
                      <td>
                        <span className="font-medium">{operator.username}</span>
                        {isMe && <span className="ml-2 text-xs text-neutral/40">you</span>}
                        {operator.hasExplicitPermissions && (
                          <span className="block text-xs text-warning">
                            custom permissions
                          </span>
                        )}
                      </td>
                      <td className="text-sm text-neutral/60">{operator.email}</td>
                      <td>
                        <Badge variant={ROLE_COLOURS[operator.adminRole] ?? 'neutral'}>
                          {readable(operator.adminRole)}
                        </Badge>
                      </td>
                      <td className="text-sm text-neutral/60">{operator.signsInWith}</td>
                      <td className="whitespace-nowrap text-sm text-neutral/60">
                        {day(operator.lastLoginAt)}
                      </td>
                      <td className="text-right">{operator.actionCount}</td>
                      <td>
                        <Badge variant={operator.isActive ? 'success' : 'error'}>
                          {operator.isActive ? 'active' : 'no access'}
                        </Badge>
                      </td>
                      <td
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            onClick={() => setEditing({ ...operator })}
                          >
                            Edit
                          </Button>
                          {/* Absent for yourself, because the API refuses it —
                              a button that always fails is worse than no button. */}
                          {!isMe && (
                            <Button
                              variant="ghost"
                              onClick={() => setActive(operator, !operator.isActive)}
                            >
                              {operator.isActive ? 'Remove access' : 'Restore'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-sm text-neutral/50">
        Access is removed, not deleted: every audit entry, approved expense and order status change
        points at the operator who did it, and taking the row away would take their name off the
        record of their own work.
      </p>

      {/* --- edit ---------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.username}` : ''}
        className="max-w-2xl"
      >
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Name"
                value={editing.username}
                onChange={(event) => setEditing({ ...editing, username: event.target.value })}
              />
              <Select
                label="Role"
                value={editing.adminRole}
                disabled={me?._id === editing._id}
                hint={
                  me?._id === editing._id
                    ? 'You cannot change your own role — ask another owner'
                    : undefined
                }
                onChange={(event) => setEditing({ ...editing, adminRole: event.target.value })}
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {readable(role.value)}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
                Permissions
              </span>
              <p className="mb-3 text-sm text-neutral/50">
                Leave every box clear to use the role's own list. Tick anything and that becomes
                their exact set, overriding the role.
              </p>

              <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto border border-base-300 p-3 sm:grid-cols-2">
                {permissions.map((permission) => {
                  const fromRole =
                    editing.explicitPermissions.length === 0 &&
                    roleDefaults(editing.adminRole).includes(permission);

                  return (
                    <label
                      key={permission}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={editing.explicitPermissions.includes(permission)}
                        onChange={() => togglePermission(permission)}
                      />
                      <span className={fromRole ? 'text-neutral' : 'text-neutral/60'}>
                        {readable(permission)}
                        {fromRole && (
                          <span className="ml-1 text-xs text-success">· from role</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSaving}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- invite -------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(inviting)}
        onClose={() => setInviting(null)}
        title="Add an operator"
        className="max-w-lg"
      >
        {inviting && (
          <form onSubmit={invite} className="space-y-4">
            <Input
              label="Name"
              required
              value={inviting.username}
              onChange={(event) => setInviting({ ...inviting, username: event.target.value })}
            />
            <Input
              label="Email"
              type="email"
              required
              value={inviting.email}
              onChange={(event) => setInviting({ ...inviting, email: event.target.value })}
            />
            <Input
              label="Temporary password"
              type="password"
              required
              minLength={8}
              hint="They should change it once they are in"
              value={inviting.password}
              onChange={(event) => setInviting({ ...inviting, password: event.target.value })}
            />
            <Select
              label="Role"
              value={inviting.role}
              onChange={(event) => setInviting({ ...inviting, role: event.target.value })}
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {readable(role.value)}
                </option>
              ))}
            </Select>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setInviting(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSaving}>
                Create
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </AdminPageShell>
  );
};

export default Staff;
