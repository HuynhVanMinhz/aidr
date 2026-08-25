import { Link } from 'react-router-dom';
import { ChatWorkspace } from '../../components/chat/ChatWorkspace';

export function ChatPage() {
  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>Messages</h1>
                <nav>
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                      <Link to="/">Home</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Messages
                    </li>
                  </ol>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-account-details">
        <div className="container">
          <ChatWorkspace variant="store" />
        </div>
      </div>
    </>
  );
}
