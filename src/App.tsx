import "./App.css";
import { useEffect, useState } from "react";
import { useTodosQuery } from "./TestHooks";
import { connector } from "./powersync/SupabaseConnector";

function App() {
  const [userID, setUserID] = useState<string | null>(null);
  const [filters] = useState({
    completed: false,
    limit: 50
  });

  const { data: complexTodos, simpleData: simpleTodos, isLoading: todosLoading, error: todosError } = useTodosQuery(filters);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await connector.client.auth.getUser();
      setUserID(user?.id || null);
    };
    getCurrentUser();
  }, []);

  if (todosLoading) {
    return <div className="loading-state">Loading...</div>;
  }
  if (todosError) {
    return <div className="error-state">Error: {todosError.message}</div>;
  }

  // Find differences
  const differences: { type: string; todo?: { list_name: string; list_created_at: string; list_owner_id: string; total_todos: number; completed_todos: number; overdue_todos: number; days_since_created: number; is_overdue: number; id: string; list_id: string; created_at: string; completed_at: string | null; description: string; created_by: string; completed_by: string | null; completed: number; }; complex?: { list_name: string; list_created_at: string; list_owner_id: string; total_todos: number; completed_todos: number; overdue_todos: number; days_since_created: number; is_overdue: number; id: string; list_id: string; created_at: string; completed_at: string | null; description: string; created_by: string; completed_by: string | null; completed: number; }; simple?: { list_name: string; list_created_at: string; list_owner_id: string; total_todos: number; completed_todos: number; overdue_todos: number; days_since_created: number; is_overdue: number; id: string; list_id: string; created_at: string; completed_at: string | null; description: string; created_by: string; completed_by: string | null; completed: number; } | undefined; }[] = [];
  const simpleIds = new Set(simpleTodos?.map(todo => todo.id));
  const complexIds = new Set(complexTodos?.map(todo => todo.id));

  // Check for items only in complexTodos
  complexTodos?.forEach(cTodo => {
    if (!simpleIds.has(cTodo.id)) {
      differences.push({ type: 'Only in Complex', todo: cTodo });
    } else {
      // Check for content differences
      const sTodo = simpleTodos.find(st => st.id === cTodo.id);
      if (JSON.stringify(cTodo) !== JSON.stringify(sTodo)) {
        differences.push({ type: 'Content Mismatch', complex: cTodo, simple: sTodo });
      }
    }
  });

  // Check for items only in simpleTodos
  simpleTodos?.forEach(sTodo => {
    if (!complexIds.has(sTodo.id)) {
      differences.push({ type: 'Only in Simple', todo: sTodo });
    }
  });

  return (
    <div className="main-container">
      <div className="content-wrapper">
        <h1 className="title-heading">Todo Query Comparison</h1>
        
        <div className="counts-section">
          <div className="count-card">
            <h3>Complex Query Count</h3>
            <p className="count-value">{complexTodos?.length ?? 0}</p>
          </div>
          <div className="count-card">
            <h3>Simple Query Count</h3>
            <p className="count-value">{simpleTodos?.length ?? 0}</p>
          </div>
        </div>

        <div className="divider" />

        <h2 className="differences-heading">Differences Found</h2>
        {differences.length > 0 ? (
          <div className="differences-list">
            {differences.map((diff, index) => (
              <div key={index} className="difference-item">
                <h3 className="difference-type">{diff.type}</h3>
                {diff.type === 'Content Mismatch' ? (
                  <div className="mismatch-details">
                    <p className="item-id"><strong>ID:</strong> {diff.complex!.id}</p>
                    <div className="data-pair">
                      <div className="data-view">
                        <h4>Complex</h4>
                        <pre className="json-data">{JSON.stringify(diff.complex, null, 2)}</pre>
                      </div>
                      <div className="data-view">
                        <h4>Simple</h4>
                        <pre className="json-data">{JSON.stringify(diff.simple, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="solo-item-details">
                    <p className="item-id"><strong>ID:</strong> {diff.todo!.id}</p>
                    <pre className="json-data">{JSON.stringify(diff.todo, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-differences-message">🥳 No differences found between the complex and simple query results. The data is consistent! 🎉</p>
        )}
      </div>
    </div>
  );
}

export default App;