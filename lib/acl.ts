import { Team, User, WikiDocument, useWikiStore } from './store';

export function getAccessibleTeams(allTeams: Team[], currentUser: User | null): Team[] {
  if (!currentUser) return [];
  if (currentUser.role === 'ADMIN') return allTeams;

  return allTeams.filter(team => 
    team.members.some(member => member.userId === currentUser.id)
  );
}

export function canUserEdit(userId: string | undefined, document: WikiDocument | null): boolean {
  if (!userId || !document) return false;
  if (document.ownerId === userId) return true;
  
  // 1. Check explicit user sharedWith roles
  const share = document.sharedWith?.find(s => s.userId === userId);
  if (share?.role === 'Editor' || share?.role === 'Admin') return true;

  // 2. Check explicit collaborators array (e.g. { userId: 'user-id', access: 'WRITE' })
  if (document.collaborators) {
    const coll = document.collaborators.find(c => c.userId === userId);
    if (coll?.access === 'WRITE') return true;
  }

  // 3. Check teamCollaborators array (e.g. { teamId: 'engineering-team', access: 'WRITE' })
  if (document.teamCollaborators && document.teamCollaborators.length > 0) {
    // Dynamically query teams from store to check membership
    const teams = useWikiStore.getState().teams || [];
    const userTeams = teams.filter(team => 
      team.members.some(member => member.userId === userId)
    );
    const hasTeamWrite = document.teamCollaborators.some(tc => 
      tc.access === 'WRITE' && userTeams.some(ut => ut.id === tc.teamId)
    );
    if (hasTeamWrite) return true;
  }
  
  return false;
}

export function canUserShare(userId: string | undefined, document: WikiDocument | null): boolean {
  if (!userId || !document) return false;
  if (document.ownerId === userId) return true;
  
  const share = document.sharedWith?.find(s => s.userId === userId);
  return share?.role === 'Admin';
}

