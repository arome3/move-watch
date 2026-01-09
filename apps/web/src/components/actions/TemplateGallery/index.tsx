'use client';

import { useState, useEffect } from 'react';
import { fetchTemplates, getTemplate, type ActionTemplateSummary, type ActionTemplate } from '@/lib/actionsApi';

interface TemplateGalleryProps {
  onSelectTemplate: (template: ActionTemplate) => void;
  onStartFromScratch: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  defi: '💰',
  security: '🔒',
  monitoring: '📊',
  nft: '🎨',
  utility: '🔧',
};

const CATEGORY_LABELS: Record<string, string> = {
  defi: 'DeFi',
  security: 'Security',
  monitoring: 'Monitoring',
  nft: 'NFT',
  utility: 'Utility',
};

const TRIGGER_ICONS: Record<string, string> = {
  event: '⚡',
  block: '📦',
  schedule: '🕐',
};

const DIFFICULTY_COLORS: Record<string, { bg: string; text: string }> = {
  beginner: { bg: 'bg-green-500/20', text: 'text-green-400' },
  intermediate: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  advanced: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

export function TemplateGallery({ onSelectTemplate, onStartFromScratch }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<ActionTemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, [selectedCategory]);

  async function loadTemplates() {
    setIsLoading(true);
    setError(null);
    try {
      const filters = selectedCategory ? { category: selectedCategory } : undefined;
      const data = await fetchTemplates(filters);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectTemplate(templateId: string) {
    setLoadingTemplateId(templateId);
    try {
      const template = await getTemplate(templateId);
      if (template) {
        onSelectTemplate(template);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoadingTemplateId(null);
    }
  }

  const categories = ['defi', 'monitoring', 'nft', 'security', 'utility'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-dark-100 mb-2">Choose a Template</h2>
        <p className="text-sm text-dark-400">
          Start with a pre-built template for common Movement Network use cases, or create from scratch
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === null
              ? 'bg-primary-500 text-white'
              : 'bg-dark-800 text-dark-400 hover:text-dark-300'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
              selectedCategory === cat
                ? 'bg-primary-500 text-white'
                : 'bg-dark-800 text-dark-400 hover:text-dark-300'
            }`}
          >
            <span>{CATEGORY_ICONS[cat]}</span>
            <span>{CATEGORY_LABELS[cat]}</span>
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={loadTemplates}
            className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-dark-800 rounded-lg p-4 border border-dark-700 animate-pulse"
            >
              <div className="h-5 bg-dark-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-dark-700 rounded w-full mb-2" />
              <div className="h-4 bg-dark-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Templates Grid */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={() => handleSelectTemplate(template.id)}
              isLoading={loadingTemplateId === template.id}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && templates.length === 0 && (
        <div className="text-center py-8">
          <p className="text-dark-400">No templates found for this category</p>
        </div>
      )}

      {/* Start from Scratch Option */}
      <div className="pt-4 border-t border-dark-700">
        <button
          onClick={onStartFromScratch}
          className="w-full py-4 border-2 border-dashed border-dark-600 rounded-lg
                     text-dark-400 hover:text-dark-300 hover:border-dark-500
                     transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Start from Scratch</span>
        </button>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onSelect,
  isLoading,
}: {
  template: ActionTemplateSummary;
  onSelect: () => void;
  isLoading: boolean;
}) {
  const difficultyColor = DIFFICULTY_COLORS[template.difficulty];

  return (
    <div
      className="bg-dark-800 rounded-lg p-4 border border-dark-700 hover:border-dark-600
                 transition-colors group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{CATEGORY_ICONS[template.category]}</span>
          <div>
            <h3 className="font-medium text-dark-100 group-hover:text-primary-400 transition-colors">
              {template.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-dark-500">
                {TRIGGER_ICONS[template.triggerType]} {template.triggerType}
              </span>
              <span className="text-dark-600">•</span>
              <span className="text-xs text-dark-500 capitalize">{template.network}</span>
            </div>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 text-xs rounded-full ${difficultyColor.bg} ${difficultyColor.text}`}
        >
          {template.difficulty}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-dark-400 mb-4 line-clamp-2">{template.description}</p>

      {/* Required Secrets */}
      {template.requiredSecrets.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-dark-500 mb-1">Required secrets:</p>
          <div className="flex flex-wrap gap-1">
            {template.requiredSecrets.map((secret) => (
              <span
                key={secret.name}
                className="px-1.5 py-0.5 bg-dark-700 rounded text-xs text-dark-400 font-mono"
                title={secret.description}
              >
                {secret.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      <button
        onClick={onSelect}
        disabled={isLoading}
        className="w-full py-2 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400
                   rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {isLoading ? 'Loading...' : 'Use Template'}
      </button>
    </div>
  );
}
