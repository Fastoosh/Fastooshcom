// TeamTab — split out of pages/Admin.tsx.
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { type TeamMember } from './adminShared';
import { TeamMemberForm } from './TeamMemberForm';

export interface TeamTabProps {
  team: TeamMember[];
  editingTeamMember: TeamMember | null;
  setEditingTeamMember: (m: TeamMember | null) => void;
  saveTeamMember: (member: TeamMember) => Promise<{ success: boolean; message: string }>;
  deleteTeamMember: (id: string) => void | Promise<void>;
}

export function TeamTab({ team, editingTeamMember, setEditingTeamMember, saveTeamMember, deleteTeamMember }: TeamTabProps) {
  return (
    <>
    <GlassCard className="p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">Team Members</h2>
        <Button
          onClick={() =>
            setEditingTeamMember({
              id: `member-${Date.now()}`,
              name: '',
              role: '',
              bio: '',
              imageUrl: '',
              socialLinks: {},
            })
          }
          className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Team Member
        </Button>
      </div>
    
      {editingTeamMember && (
        <TeamMemberForm
          member={editingTeamMember}
          onSave={saveTeamMember}
          onCancel={() => setEditingTeamMember(null)}
        />
      )}
    
      <div className="space-y-4">
        {team.map((member) => (
          <div
            key={member.id}
            className="flex justify-between items-center p-4 bg-white/5 rounded-lg border border-white/10"
          >
            <div>
              <h3 className="text-white font-semibold">{member.name}</h3>
              <p className="text-gray-400 text-sm">{member.role}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingTeamMember(member)}
                className="bg-black text-white hover:bg-white hover:text-black dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white border-transparent group cursor-pointer"
              >
                <Pencil className="w-4 h-4 group-hover:text-purple-400 transition-colors" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteTeamMember(member.id)}
                className="cursor-pointer hover:bg-red-600/20 group text-white"
              >
                <Trash2 className="w-4 h-4 group-hover:text-red-400 transition-colors" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
    </>
  );
}
