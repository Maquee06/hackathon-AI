import ApplianceCard from './ApplianceCard';
import StatsBar from './StatsBar';

export default function ApplianceGrid({ appliances, sessionStarts, onToggle, onReset }) {
  const list = Object.values(appliances);

  return (
    <div className="grid" id="applianceGrid">
      {list.map((appliance) => (
        <ApplianceCard
          key={appliance.id}
          appliance={appliance}
          sessionStart={sessionStarts[appliance.id] || null}
          onToggle={onToggle}
          onReset={onReset}
        />
      ))}
      <StatsBar appliances={appliances} />
    </div>
  );
}
