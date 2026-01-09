'use client';

import { useState, useEffect, useRef } from 'react';
import type { EventTriggerConfig as EventTriggerConfigType, FilterCondition } from '@movewatch/shared';

interface EventTriggerConfigProps {
  value: EventTriggerConfigType | null;
  onChange: (config: EventTriggerConfigType) => void;
  errors?: Record<string, string>;
}

export function EventTriggerConfig({ value, onChange, errors }: EventTriggerConfigProps) {
  const [eventType, setEventType] = useState(value?.eventType || '');
  const [moduleAddress, setModuleAddress] = useState(value?.moduleAddress || '');
  const [filterField, setFilterField] = useState('');
  const [filterOperator, setFilterOperator] = useState<FilterCondition['operator']>('eq');
  const [filterValue, setFilterValue] = useState('');
  const [filters, setFilters] = useState<Record<string, FilterCondition>>(value?.filters || {});

  // Use ref to avoid infinite loops with onChange callback
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (eventType) {
      onChangeRef.current({
        type: 'event',
        eventType,
        moduleAddress: moduleAddress || undefined,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });
    }
  }, [eventType, moduleAddress, filters]);

  const addFilter = () => {
    if (!filterField || !filterValue) return;

    const newFilters = {
      ...filters,
      [filterField]: {
        operator: filterOperator,
        value: isNaN(Number(filterValue)) ? filterValue : Number(filterValue),
      },
    };
    setFilters(newFilters);
    setFilterField('');
    setFilterValue('');
  };

  const removeFilter = (field: string) => {
    const newFilters = { ...filters };
    delete newFilters[field];
    setFilters(newFilters);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Event Type <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          placeholder="0x1::coin::DepositEvent"
          className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm
                     text-dark-100 placeholder:text-dark-600
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     transition-colors font-mono
                     ${errors?.eventType ? 'border-red-500' : 'border-dark-700'}`}
        />
        <p className="mt-1 text-xs text-dark-500">
          Use * as suffix for wildcards (e.g., 0x1::coin::*)
        </p>
        {errors?.eventType && (
          <p className="mt-1 text-xs text-red-400">{errors.eventType}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Module Address (optional)
        </label>
        <input
          type="text"
          value={moduleAddress}
          onChange={(e) => setModuleAddress(e.target.value)}
          placeholder="0x1"
          className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                     text-dark-100 placeholder:text-dark-600
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     transition-colors font-mono"
        />
        <p className="mt-1 text-xs text-dark-500">
          Additional filter by module address
        </p>
      </div>

      {/* Filters */}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Field Filters (optional)
        </label>

        {/* Existing filters */}
        {Object.keys(filters).length > 0 && (
          <div className="mb-3 space-y-2">
            {Object.entries(filters).map(([field, condition]) => (
              <div
                key={field}
                className="flex items-center gap-2 bg-dark-900 px-3 py-2 rounded-lg text-sm"
              >
                <span className="text-dark-300 font-mono">{field}</span>
                <span className="text-dark-500">{condition.operator}</span>
                <span className="text-primary-400 font-mono">
                  {JSON.stringify(condition.value)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFilter(field)}
                  className="ml-auto text-dark-500 hover:text-red-400"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add filter form */}
        <div className="flex gap-2">
          <input
            type="text"
            value={filterField}
            onChange={(e) => setFilterField(e.target.value)}
            placeholder="Field (e.g., amount)"
            className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                       text-dark-100 placeholder:text-dark-600 font-mono
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <select
            value={filterOperator}
            onChange={(e) => setFilterOperator(e.target.value as FilterCondition['operator'])}
            className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                       text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="eq">=</option>
            <option value="ne">!=</option>
            <option value="gt">&gt;</option>
            <option value="gte">&gt;=</option>
            <option value="lt">&lt;</option>
            <option value="lte">&lt;=</option>
            <option value="contains">contains</option>
          </select>
          <input
            type="text"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Value"
            className="w-32 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm
                       text-dark-100 placeholder:text-dark-600 font-mono
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={addFilter}
            disabled={!filterField || !filterValue}
            className="px-3 py-2 bg-dark-700 hover:bg-dark-600 text-dark-300
                       rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
