import { ChefHat, Music, Briefcase, Camera, Heart, TreePine } from 'lucide-react';
import { ReactNode } from 'react';

export interface Interest {
  id: string;
  label: string;
  icon: ReactNode;
}

export const INTERESTS: Interest[] = [
  { id: 'culinary', label: 'Culinary Arts', icon: <ChefHat className="w-4 h-4" /> },
  { id: 'tech', label: 'Tech Innovation', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'music', label: 'Jazz & Vinyl', icon: <Music className="w-4 h-4" /> },
  { id: 'photography', label: 'Photography', icon: <Camera className="w-4 h-4" /> },
  { id: 'philanthropy', label: 'Philanthropy', icon: <Heart className="w-4 h-4" /> },
  { id: 'outdoors', label: 'Nature', icon: <TreePine className="w-4 h-4" /> },
];
