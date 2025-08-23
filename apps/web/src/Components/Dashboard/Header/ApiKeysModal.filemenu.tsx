import React, { useState, useEffect } from 'react';
import { useRecoilState, atom } from 'recoil';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import { 
  Key,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Activity,
  Settings
} from "lucide-react";
import { toast } from 'sonner'; // Import sonner
import api from '@/api';

import { 
    type IApiKey, 
    type ApiKeyFormData,
    type ServiceType, 
    apiKeysState, 
    apiKeysLoadingState
} from "@/State/Dashboard.state"

export interface ApiKeyManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Local atoms for component-specific state
const showKeyState = atom<Record<string, boolean>>({
  key: 'showKeyState',
  default: {},
});

// API Key Management Modal
export const ApiKeyManagementModal: React.FC<ApiKeyManagementModalProps> = ({ isOpen }) => {
  const [apiKeys, setApiKeys] = useRecoilState(apiKeysState);
  const [loading, setLoading] = useRecoilState(apiKeysLoadingState);
  const [showKey, setShowKey] = useRecoilState(showKeyState);
  
  // Local state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingKey, setEditingKey] = useState<IApiKey | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<ApiKeyFormData>({
    name: '',
    key: '',
    service: '',
    weight: 1
  });

  // Load API keys from backend
  const loadApiKeys = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await api.get('/api-keys');
      setApiKeys(response.data);
    } catch (error: any) {
      console.error('Failed to load API keys:', error);
      toast.error(error.response?.data?.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadApiKeys();
    }
  }, [isOpen]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!formData.service) {
      toast.error('Please select a service');
      return;
    }

    try {
      setLoading(true);
      
      if (editingKey) {
        const updateData = { ...formData };
        if (!updateData.key) {
          // @ts-ignore
            delete updateData.key; 
        }
        await api.put(`/api-keys/${editingKey._id}`, updateData);
        toast.success('API key updated successfully');
      } else {
        await api.post('/api-keys', formData);
        toast.success('API key added successfully');
      }
      
      await loadApiKeys();
      setShowAddForm(false);
      setEditingKey(null);
      setFormData({ name: '', key: '', service: '', weight: 1 });
    } catch (error: any) {
      console.error('Failed to save API key:', error);
      toast.error(error.response?.data?.message || 'Failed to save API key');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    
    try {
      setLoading(true);
      await api.delete(`/api-keys/${id}`);
      await loadApiKeys();
      toast.success('API key deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete API key:', error);
      toast.error(error.response?.data?.message || 'Failed to delete API key');
    } finally {
      setLoading(false);
    }
  };

  // Start editing
  const startEdit = (key: IApiKey): void => {
    setEditingKey(key);
    setFormData({
      name: key.name,
      key: '',
      service: key.service,
      weight: key.weight
    });
    setShowAddForm(true);
  };

  const toggleShowKey = (id: string): void => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getServiceColor = (service: ServiceType): string => {
    const colors: Record<ServiceType, string> = {
      openai: 'bg-green-900/50 text-green-300 border-green-800',
      anthropic: 'bg-orange-900/50 text-orange-300 border-orange-800',
      cohere: 'bg-blue-900/50 text-blue-300 border-blue-800',
      mistral: 'bg-purple-900/50 text-purple-300 border-purple-800',
      gemini: 'bg-red-900/50 text-red-300 border-red-800'
    };
    return colors[service] || 'bg-gray-900/50 text-gray-300 border-gray-800';
  };

  const handleFormDataChange = (field: keyof ApiKeyFormData, value: string | number): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = (): void => {
    setShowAddForm(false);
    setEditingKey(null);
    setFormData({ name: '', key: '', service: '', weight: 1 });
  };

  return (
    <DialogContent className="sm:max-w-4xl bg-neutral-950 border-neutral-800 text-neutral-100 max-h-[80vh] flex flex-col">
      <DialogHeader className="border-b border-neutral-800 pb-4 flex-shrink-0">
        <DialogTitle className="text-white flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-blue-600/20 border border-blue-600/30">
            <Key className="h-5 w-5 text-blue-400" />
          </div>
          API Key Management
        </DialogTitle>
        <DialogDescription className="text-neutral-400 text-sm">
          Configure and manage your API keys for external AI services. Higher weights are used for complex tasks, lower weights for simple ones.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto min-h-0 pr-2">
        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="mb-6 p-4 bg-neutral-900/50 rounded-lg border border-neutral-800 flex-shrink-0">
            <h3 className="text-lg font-medium mb-4 text-white flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {editingKey ? 'Edit API Key' : 'Add New API Key'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-neutral-300">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleFormDataChange('name', e.target.value)}
                    className="bg-neutral-900/50 border-neutral-700 text-white focus:border-blue-500"
                    placeholder="e.g., Primary OpenAI Key"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="service" className="text-neutral-300">Service</Label>
                  <Select 
                    value={formData.service} 
                    onValueChange={(value: ServiceType) => handleFormDataChange('service', value)}
                  >
                    <SelectTrigger className="bg-neutral-900/50 border-neutral-700 text-white">
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-neutral-700">
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="cohere">Cohere</SelectItem>
                      <SelectItem value="mistral">Mistral</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="key" className="text-neutral-300">API Key</Label>
                <Input
                  id="key"
                  type="password"
                  value={formData.key}
                  onChange={(e) => handleFormDataChange('key', e.target.value)}
                  className="bg-neutral-900/50 border-neutral-700 text-white focus:border-blue-500 font-mono"
                  placeholder={editingKey ? "Enter new API key (leave empty to keep current)" : "Enter your API key"}
                  required={!editingKey}
                />
              </div>

              <div>
                <Label htmlFor="weight" className="text-neutral-300">
                  Weight (1-10)
                  <span className="text-xs text-neutral-500 ml-2">Higher = Complex tasks, Lower = Simple tasks</span>
                </Label>
                <Input
                  id="weight"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.weight}
                  onChange={(e) => handleFormDataChange('weight', parseInt(e.target.value) || 1)}
                  className="bg-neutral-900/50 border-neutral-700 text-white focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? 'Saving...' : (editingKey ? 'Update Key' : 'Add Key')}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={resetForm}
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* API Keys List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-medium text-white">Your API Keys ({apiKeys.length})</h3>
            {!showAddForm && (
              <Button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Key
              </Button>
            )}
          </div>

          {loading && apiKeys.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <Settings className="h-8 w-8 mx-auto mb-2 animate-spin" />
              Loading API keys...
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No API keys configured</p>
              <p className="text-sm">Add your first API key to get started</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {apiKeys.map((apiKey) => (
                <div key={apiKey._id} className="p-4 bg-neutral-900/30 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-white">{apiKey.name}</h4>
                        <span className={`px-2 py-1 rounded text-xs border ${getServiceColor(apiKey.service)}`}>
                          {apiKey.service.toUpperCase()}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-neutral-400">
                          <Activity className="h-3 w-3" />
                          Weight: {apiKey.weight}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-neutral-400">
                        <span>Calls: {apiKey.apicalls}</span>
                        <span>Added: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                        <span className={`${apiKey.isActive ? 'text-green-400' : 'text-red-400'}`}>
                          {apiKey.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-neutral-500 font-mono">
                          {showKey[apiKey._id] ? (apiKey.key || '••••••••••••••••') : '••••••••••••••••'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleShowKey(apiKey._id)}
                          className="h-6 w-6 p-0 text-neutral-400 hover:text-white"
                        >
                          {showKey[apiKey._id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(apiKey)}
                        className="h-8 w-8 p-0 text-neutral-400 hover:text-blue-400"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(apiKey._id)}
                        className="h-8 w-8 p-0 text-neutral-400 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  );
};