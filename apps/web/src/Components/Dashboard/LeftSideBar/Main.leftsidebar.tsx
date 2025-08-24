import { useState } from 'react';
import { 
  FileText, 
  Users, 
  ChevronRight,
  ScissorsLineDashedIcon,
  LucideNetwork,
  LayoutTemplateIcon
} from 'lucide-react';
import AssetStash from './AssetStash.leftsidebar';
import TemplatesComponent from './Template.leftsidebar';
import ProjectDescriptionComponent from './Script.leftsidebar';
import CollaboratorsComponent from './Collaborators.leftsidebar';
import TimelineTracksSidebar from './Tracks.leftsidebar';

import type { Asset, Project, Template, User } from '@/State/Types';

interface Props {
  assets?: Asset[],
  currentProject?: Project,
  user?: User,
  templates: Template[];
}

const MainSidebar = ({assets, currentProject, user, templates}:Props) => {
  const [activeTab, setActiveTab] = useState('explorer');
  const [isExpanded, setIsExpanded] = useState(true);
  const sidebarTabs = [
    { id: 'explorer', icon: LucideNetwork, label: 'Explorer' },
    { id: 'tracks', icon: ScissorsLineDashedIcon, label: 'Tracks' },
    { id: 'templates', icon: LayoutTemplateIcon, label: 'Templates' },
    { id: 'description', icon: FileText, label: 'Project Description' },
    { id: 'collaborators', icon: Users, label: 'Collaborators' }
  ];

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'explorer':
        return <AssetStash allAssets={assets} />;
      case 'tracks':
        return <TimelineTracksSidebar />;
      case 'templates':
        return <TemplatesComponent  allTemplates={templates} currentProject={currentProject}/>;
      case 'description':
        return <ProjectDescriptionComponent />;
      case 'collaborators':
        return <CollaboratorsComponent />;
      default:
        return <AssetStash />;
    }
  };

  return (
    <div className="flex h-full bg-neutral-950 border-r border-neutral-800">
      {/* Icon Strip (Always Visible) - Aligned with header height (48px) */}
      <div className="w-12 bg-neutral-950 border-r border-neutral-800 flex flex-col">
        {/* Top spacing to align with logo - matches header height */}
      
        <div className="flex flex-col py-2">
          {sidebarTabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (!isExpanded) setIsExpanded(true);
                }}
                className={`
                  w-12 h-12 flex items-center justify-center
                  hover:bg-neutral-800 transition-colors
                  ${activeTab === tab.id ? 'bg-neutral-800 border-r-2 border-blue-500' : ''}
                `}
                title={tab.label}
              >
                <IconComponent 
                  size={20} 
                  className={`${activeTab === tab.id ? 'text-white' : 'text-neutral-400'}`} 
                />
              </button>
            );
          })}
        </div>
        
        {/* Toggle Button */}
        <div className="mt-auto mb-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-12 h-8 flex items-center justify-center hover:bg-neutral-800 transition-colors"
          >
            <ChevronRight 
              size={16} 
              className={`text-neutral-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            />
          </button>
        </div>
      </div>

      {/* Expanded Content - Reduced width from 320px to 280px */}
      {isExpanded && (
        <div className="w-70 bg-neutral-950 flex flex-col overflow-hidden">
          {renderActiveComponent()}
        </div>
      )}
    </div>
  );
};

export default MainSidebar;