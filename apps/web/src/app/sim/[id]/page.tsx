import { notFound } from 'next/navigation';
import { getSharedSimulation } from '@/lib/api';
import { SharedSimulationView } from './SharedSimulationView';

interface PageProps {
  params: { id: string };
}

export default async function SharedSimulationPage({ params }: PageProps) {
  const simulation = await getSharedSimulation(params.id);

  if (!simulation) {
    notFound();
  }

  return <SharedSimulationView simulation={simulation} />;
}

export async function generateMetadata({ params }: PageProps) {
  return {
    title: `Simulation ${params.id} - MoveWatch`,
    description: 'View shared transaction simulation results on MoveWatch',
  };
}
