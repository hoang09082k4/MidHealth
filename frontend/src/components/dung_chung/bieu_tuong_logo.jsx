import { useEffect, useState } from 'react';
import { useClinic, defaultClinic } from '../../lib/clinic';
function BieuTuongLogo() {
  const clinic = useClinic();
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [clinic.logo]);
  if (clinic.logo && clinic.logo !== defaultClinic.logo && !logoFailed) return <img className="clinic-custom-logo" src={clinic.logo} alt={clinic.name} onError={() => setLogoFailed(true)} />;
  return (
    <span className="logo" aria-label="MidHealth">
      <span className="logo-word logo-word-blue">Mid</span>
      <span className="logo-word logo-word-green">Health</span>
    </span>
  );
}

export default BieuTuongLogo;
