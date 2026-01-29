import { useState, useCallback } from 'react';
import type { EvaluationTemplate, CreateTemplateData } from '../types';
import { api } from '../api/client';

export function useEvaluationTemplates() {
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.listEvaluationTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load evaluation templates:', err);
      setError('Failed to load evaluation templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (data: CreateTemplateData): Promise<EvaluationTemplate | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const created = await api.createEvaluationTemplate(data);
      setTemplates(prev => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('Failed to create evaluation template:', err);
      setError('Failed to create evaluation template');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateTemplate = useCallback(async (
    id: string,
    data: Partial<CreateTemplateData>
  ): Promise<EvaluationTemplate | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const updated = await api.updateEvaluationTemplate(id, data);
      // Copy-on-write versioning: if the returned template has a different id,
      // the backend created a new version. Replace the old one with the new one.
      setTemplates(prev => prev.map(t => t.id === id ? updated : t));
      return updated;
    } catch (err) {
      console.error('Failed to update evaluation template:', err);
      setError('Failed to update evaluation template');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      await api.deleteEvaluationTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      return true;
    } catch (err) {
      console.error('Failed to delete evaluation template:', err);
      setError('Failed to delete evaluation template');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    templates,
    isLoading,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
