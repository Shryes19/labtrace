import { requirePageUser } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { lookups } from '@/lib/queries';
import EquipmentForm from '../EquipmentForm';

export default async function NewEquipment() {
  const user = await requirePageUser('admin');
  const lk = await withUser(user, (c) => lookups(c));
  return (<><div className="page-head"><h1>Add equipment</h1></div><EquipmentForm lookups={lk} /></>);
}
