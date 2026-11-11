import { requirePageUser } from '@/lib/auth';
import ArticleForm from '../ArticleForm';

export default async function NewArticle() {
  await requirePageUser('technician', 'admin');
  return (<><div className="page-head"><h1>New knowledge article</h1></div><ArticleForm /></>);
}
