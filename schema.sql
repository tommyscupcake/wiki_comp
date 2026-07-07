-- PostgreSQL Schema for Enterprise Wiki

CREATE TYPE user_role AS ENUM ('ADMIN', 'CREATOR', 'VIEWER');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');
CREATE TYPE doc_visibility AS ENUM ('PRIVATE', 'WORKSPACE', 'PUBLIC');
CREATE TYPE access_level AS ENUM ('Viewer', 'Editor');
CREATE TYPE notif_type AS ENUM ('MENTION', 'ACCESS_GRANTED', 'VERSION_PUBLISHED', 'COMMENT_ADDED');

CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'VIEWER',
    status user_status DEFAULT 'ACTIVE',
    requires_password_change BOOLEAN DEFAULT FALSE,
    profile_pic TEXT,
    session_version INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teams (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_trashed BOOLEAN DEFAULT FALSE,
    trashed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_members (
    team_id VARCHAR(255) REFERENCES teams(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    team_role VARCHAR(50) DEFAULT 'Member',
    PRIMARY KEY (team_id, user_id)
);

CREATE TABLE wiki_documents (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    owner_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    visibility doc_visibility DEFAULT 'PRIVATE',
    is_deleted BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_collaborators (
    document_id VARCHAR(255) REFERENCES wiki_documents(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    access access_level DEFAULT 'Viewer',
    PRIMARY KEY (document_id, user_id)
);

CREATE TABLE document_team_collaborators (
    document_id VARCHAR(255) REFERENCES wiki_documents(id) ON DELETE CASCADE,
    team_id VARCHAR(255) REFERENCES teams(id) ON DELETE CASCADE,
    access access_level DEFAULT 'Viewer',
    PRIMARY KEY (document_id, team_id)
);

CREATE TABLE document_shared_with (
    document_id VARCHAR(255) REFERENCES wiki_documents(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'Viewer',
    PRIMARY KEY (document_id, user_id)
);

CREATE TABLE document_history (
    version_id VARCHAR(255) PRIMARY KEY,
    document_id VARCHAR(255) REFERENCES wiki_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_comments (
    comment_id VARCHAR(255) PRIMARY KEY,
    document_id VARCHAR(255) REFERENCES wiki_documents(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    author_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    target_text TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    admin_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    admin_name VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    details TEXT,
    target_user_id VARCHAR(255),
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE wiki_templates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    type notif_type NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
