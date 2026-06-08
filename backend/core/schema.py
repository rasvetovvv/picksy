"""Database schema (CREATE TABLE statements) + init_db migration runner.

init_db() is called once on app startup (lifespan). It is idempotent: every
CREATE uses IF NOT EXISTS, and the migrations list tolerates "duplicate
column" / "duplicate index" errors so it is safe to run repeatedly.
"""
from backend.core.db import get_db
from backend.core.settings import (
    DEFAULT_SITE_SETTINGS,
    _serialize_setting_value,
)


TABLES = {
    "users": """
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(64) UNIQUE DEFAULT NULL,
            display_name VARCHAR(80) DEFAULT NULL,
            bio VARCHAR(240) DEFAULT NULL,
            avatar_emoji VARCHAR(16) DEFAULT NULL,
            password_hash VARCHAR(255) NOT NULL,
            token VARCHAR(255) UNIQUE,
            is_admin TINYINT(1) NOT NULL DEFAULT 0,
            is_verified TINYINT(1) NOT NULL DEFAULT 0,
            role VARCHAR(32) NOT NULL DEFAULT 'user',
            banner_url VARCHAR(500) DEFAULT NULL,
            accent_color VARCHAR(7) DEFAULT NULL,
            fav_film_id VARCHAR(64) DEFAULT NULL,
            fav_film_title VARCHAR(300) DEFAULT NULL,
            fav_film_poster VARCHAR(500) DEFAULT NULL,
            fav_film_type VARCHAR(16) DEFAULT NULL,
            fav_film_comment VARCHAR(300) DEFAULT NULL,
            social_telegram VARCHAR(120) DEFAULT NULL,
            social_instagram VARCHAR(120) DEFAULT NULL,
            social_letterboxd VARCHAR(120) DEFAULT NULL,
            social_website VARCHAR(250) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email (email),
            INDEX idx_token (token),
            INDEX idx_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "saved_movies": """
        CREATE TABLE IF NOT EXISTS saved_movies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            tmdb_id INT NOT NULL,
            title VARCHAR(500) NOT NULL,
            poster VARCHAR(500) DEFAULT NULL,
            year VARCHAR(10) DEFAULT NULL,
            rating VARCHAR(10) DEFAULT NULL,
            tmdb_url VARCHAR(500) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_movie (user_id, tmdb_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_movies (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "saved_tv": """
        CREATE TABLE IF NOT EXISTS saved_tv (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            tmdb_id INT NOT NULL,
            title VARCHAR(500) NOT NULL,
            poster VARCHAR(500) DEFAULT NULL,
            year VARCHAR(10) DEFAULT NULL,
            rating VARCHAR(10) DEFAULT NULL,
            tmdb_url VARCHAR(500) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_tv (user_id, tmdb_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_tv (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "saved_books": """
        CREATE TABLE IF NOT EXISTS saved_books (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            volume_id VARCHAR(64) NOT NULL,
            title VARCHAR(500) NOT NULL,
            poster VARCHAR(500) DEFAULT NULL,
            year VARCHAR(10) DEFAULT NULL,
            rating VARCHAR(10) DEFAULT NULL,
            book_url VARCHAR(500) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_book (user_id, volume_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_books (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "user_stats": """
        CREATE TABLE IF NOT EXISTS user_stats (
            user_id INT PRIMARY KEY,
            search_count INT DEFAULT 0,
            random_count INT DEFAULT 0,
            ai_search_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "mascot_state": """
        CREATE TABLE IF NOT EXISTS mascot_state (
            user_id INT PRIMARY KEY,
            state JSON NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "pick_history": """
        CREATE TABLE IF NOT EXISTS pick_history (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            type ENUM('movie','tv','book') NOT NULL,
            item_id VARCHAR(64) NOT NULL,
            title VARCHAR(500) NOT NULL,
            poster VARCHAR(500) DEFAULT NULL,
            year VARCHAR(10) DEFAULT NULL,
            rating VARCHAR(10) DEFAULT NULL,
            item_url VARCHAR(500) DEFAULT NULL,
            picked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_history (user_id, picked_at),
            INDEX idx_user_type (user_id, type, picked_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "announcements": """
        CREATE TABLE IF NOT EXISTS announcements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            message TEXT NOT NULL,
            type ENUM('info','warning','success') NOT NULL DEFAULT 'info',
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "activity_log": """
        CREATE TABLE IF NOT EXISTS activity_log (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT DEFAULT NULL,
            action VARCHAR(64) NOT NULL,
            detail VARCHAR(500) DEFAULT NULL,
            ip VARCHAR(45) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_created (created_at),
            INDEX idx_user_action (user_id, action)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "site_settings": """
        CREATE TABLE IF NOT EXISTS site_settings (
            name VARCHAR(128) PRIMARY KEY,
            value TEXT DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "feedback": """
        CREATE TABLE IF NOT EXISTS feedback (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT DEFAULT NULL,
            email VARCHAR(255) DEFAULT NULL,
            message TEXT NOT NULL,
            category VARCHAR(32) NOT NULL DEFAULT 'general',
            status ENUM('new','read','done') NOT NULL DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_status (status),
            INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "game_ratings": """
        CREATE TABLE IF NOT EXISTS game_ratings (
            user_id INT PRIMARY KEY,
            rating INT NOT NULL DEFAULT 100,
            wins INT NOT NULL DEFAULT 0,
            losses INT NOT NULL DEFAULT 0,
            draws INT NOT NULL DEFAULT 0,
            game_banned TINYINT(1) NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "game_matches": """
        CREATE TABLE IF NOT EXISTS game_matches (
            id VARCHAR(36) PRIMARY KEY,
            player1_id INT NOT NULL,
            player2_id INT DEFAULT NULL,
            movie_title VARCHAR(500) DEFAULT NULL,
            movie_poster VARCHAR(500) DEFAULT NULL,
            movie_year INT DEFAULT NULL,
            movie_rating FLOAT DEFAULT NULL,
            p1_guess_rating FLOAT DEFAULT NULL,
            p1_guess_year INT DEFAULT NULL,
            p2_guess_rating FLOAT DEFAULT NULL,
            p2_guess_year INT DEFAULT NULL,
            winner_id INT DEFAULT NULL,
            status ENUM('waiting','playing','guessing','finished') NOT NULL DEFAULT 'waiting',
            round_num INT NOT NULL DEFAULT 1,
            guess_deadline TIMESTAMP DEFAULT NULL,
            lobby_code VARCHAR(16) DEFAULT NULL,
            is_private TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_status (status),
            INDEX idx_players (player1_id, player2_id),
            INDEX idx_lobby_code (lobby_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "user_subscriptions": """
        CREATE TABLE IF NOT EXISTS user_subscriptions (
            user_id INT PRIMARY KEY,
            tier ENUM('free','premium','pro') NOT NULL DEFAULT 'free',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NULL DEFAULT NULL,
            trial_used_at TIMESTAMP NULL DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "role_audit_log": """
        CREATE TABLE IF NOT EXISTS role_audit_log (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            target_user_id INT NOT NULL,
            changed_by INT NOT NULL,
            old_role VARCHAR(32) NOT NULL DEFAULT 'user',
            new_role VARCHAR(32) NOT NULL,
            reason VARCHAR(500) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_target (target_user_id),
            INDEX idx_changed_by (changed_by),
            FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "short_links": """
        CREATE TABLE IF NOT EXISTS short_links (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(32) UNIQUE NOT NULL,
            target_url VARCHAR(1000) NOT NULL,
            title VARCHAR(255) DEFAULT NULL,
            click_count INT NOT NULL DEFAULT 0,
            created_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_code (code),
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "daily_pick_counts": """
        CREATE TABLE IF NOT EXISTS daily_pick_counts (
            user_id INT NOT NULL,
            pick_date DATE NOT NULL,
            pick_count INT NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, pick_date),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "user_collections": """
        CREATE TABLE IF NOT EXISTS user_collections (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            collections_json MEDIUMTEXT DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "analytics_events": """
        CREATE TABLE IF NOT EXISTS analytics_events (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            session_id VARCHAR(64) NOT NULL,
            user_id INT DEFAULT NULL,
            event_type VARCHAR(64) NOT NULL,
            event_data JSON DEFAULT NULL,
            page_url VARCHAR(500) DEFAULT NULL,
            referrer VARCHAR(500) DEFAULT NULL,
            ip VARCHAR(45) DEFAULT NULL,
            user_agent VARCHAR(500) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_session (session_id),
            INDEX idx_event_type (event_type, created_at),
            INDEX idx_user (user_id, created_at),
            INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "analytics_clicks": """
        CREATE TABLE IF NOT EXISTS analytics_clicks (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            session_id VARCHAR(64) NOT NULL,
            user_id INT DEFAULT NULL,
            x INT NOT NULL,
            y INT NOT NULL,
            element_selector VARCHAR(500) DEFAULT NULL,
            page_url VARCHAR(500) DEFAULT NULL,
            viewport_w INT DEFAULT NULL,
            viewport_h INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_page (page_url(191), created_at),
            INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "analytics_sessions": """
        CREATE TABLE IF NOT EXISTS analytics_sessions (
            id VARCHAR(64) PRIMARY KEY,
            user_id INT DEFAULT NULL,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            page_views INT NOT NULL DEFAULT 1,
            events_count INT NOT NULL DEFAULT 0,
            funnel_step ENUM('visit','register','first_pick','active') NOT NULL DEFAULT 'visit',
            ip VARCHAR(45) DEFAULT NULL,
            user_agent VARCHAR(500) DEFAULT NULL,
            referrer VARCHAR(500) DEFAULT NULL,
            INDEX idx_user (user_id),
            INDEX idx_funnel (funnel_step, started_at),
            INDEX idx_started (started_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "payment_requests": """
        CREATE TABLE IF NOT EXISTS payment_requests (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            tier VARCHAR(16) NOT NULL,
            days INT NOT NULL DEFAULT 30,
            amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            card_info TEXT DEFAULT NULL,
            status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
            receipt_id VARCHAR(64) DEFAULT NULL,
            processed_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user (user_id),
            INDEX idx_status (status),
            INDEX idx_receipt (receipt_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "user_cosmetics": """
        CREATE TABLE IF NOT EXISTS user_cosmetics (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            item_type ENUM('avatar','frame','emoji') NOT NULL,
            item_id VARCHAR(64) NOT NULL,
            equipped TINYINT(1) NOT NULL DEFAULT 0,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user (user_id),
            UNIQUE KEY uk_user_item (user_id, item_type, item_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "community_ratings": """
        CREATE TABLE IF NOT EXISTS community_ratings (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            content_type ENUM('movie','tv','book') NOT NULL,
            content_id VARCHAR(64) NOT NULL,
            rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 10),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_user_content (user_id, content_type, content_id),
            INDEX idx_content (content_type, content_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "user_reviews": """
        CREATE TABLE IF NOT EXISTS user_reviews (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            content_type ENUM('movie','tv','book') NOT NULL,
            content_id VARCHAR(64) NOT NULL,
            review_text TEXT NOT NULL,
            rating TINYINT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_user_review (user_id, content_type, content_id),
            INDEX idx_content (content_type, content_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "duo_usage": """
        CREATE TABLE IF NOT EXISTS duo_usage (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_date (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    # ── Public / shared collections ──
    "published_collections": """
        CREATE TABLE IF NOT EXISTS published_collections (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            owner_id INT NOT NULL,
            local_id VARCHAR(64) NOT NULL,
            slug VARCHAR(80) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL DEFAULT '',
            emoji VARCHAR(16) NOT NULL DEFAULT '',
            description TEXT DEFAULT NULL,
            items_json MEDIUMTEXT DEFAULT NULL,
            visibility ENUM('private','unlisted','public') NOT NULL DEFAULT 'public',
            likes_count INT NOT NULL DEFAULT 0,
            comments_count INT NOT NULL DEFAULT 0,
            views_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_owner_local (owner_id, local_id),
            INDEX idx_visibility_updated (visibility, updated_at),
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "collection_likes": """
        CREATE TABLE IF NOT EXISTS collection_likes (
            collection_id BIGINT NOT NULL,
            user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (collection_id, user_id),
            INDEX idx_user_likes (user_id, created_at),
            FOREIGN KEY (collection_id) REFERENCES published_collections(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "collection_comments": """
        CREATE TABLE IF NOT EXISTS collection_comments (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            collection_id BIGINT NOT NULL,
            user_id INT NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_collection_created (collection_id, created_at),
            INDEX idx_user (user_id),
            FOREIGN KEY (collection_id) REFERENCES published_collections(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "collection_collaborators": """
        CREATE TABLE IF NOT EXISTS collection_collaborators (
            collection_id BIGINT NOT NULL,
            user_id INT NOT NULL,
            role ENUM('owner','editor','viewer') NOT NULL DEFAULT 'editor',
            invited_by INT DEFAULT NULL,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (collection_id, user_id),
            INDEX idx_user_role (user_id, role),
            FOREIGN KEY (collection_id) REFERENCES published_collections(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "collection_invites": """
        CREATE TABLE IF NOT EXISTS collection_invites (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            collection_id BIGINT NOT NULL,
            token VARCHAR(64) NOT NULL UNIQUE,
            role ENUM('editor','viewer') NOT NULL DEFAULT 'editor',
            created_by INT NOT NULL,
            uses_left INT NOT NULL DEFAULT 1,
            expires_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_collection (collection_id),
            FOREIGN KEY (collection_id) REFERENCES published_collections(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "user_follows": """
        CREATE TABLE IF NOT EXISTS user_follows (
            follower_id INT NOT NULL,
            target_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (follower_id, target_id),
            INDEX idx_target (target_id, created_at),
            FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "user_recommendations": """
        CREATE TABLE IF NOT EXISTS user_recommendations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            item_type VARCHAR(16) NOT NULL DEFAULT 'movie',
            item_id VARCHAR(64) NOT NULL,
            item_title VARCHAR(300) DEFAULT NULL,
            item_poster VARCHAR(500) DEFAULT NULL,
            comment VARCHAR(300) DEFAULT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_user_item (user_id, item_type, item_id),
            INDEX idx_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "user_showcase_badges": """
        CREATE TABLE IF NOT EXISTS user_showcase_badges (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            badge_id VARCHAR(64) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            UNIQUE KEY uk_user_badge (user_id, badge_id),
            INDEX idx_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "movie_gifts": """
        CREATE TABLE IF NOT EXISTS movie_gifts (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            token VARCHAR(48) NOT NULL UNIQUE,
            sender_id INT NOT NULL,
            sender_name VARCHAR(120) DEFAULT NULL,
            item_type VARCHAR(16) NOT NULL,
            item_id VARCHAR(64) NOT NULL,
            item_title VARCHAR(255) DEFAULT NULL,
            item_poster VARCHAR(512) DEFAULT NULL,
            item_year VARCHAR(16) DEFAULT NULL,
            item_overview TEXT DEFAULT NULL,
            note VARCHAR(280) DEFAULT NULL,
            voice_data MEDIUMTEXT DEFAULT NULL,
            theme VARCHAR(24) NOT NULL DEFAULT 'classic',
            gift_mode VARCHAR(16) NOT NULL DEFAULT 'single',
            max_opens INT NOT NULL DEFAULT 1,
            recipient_name VARCHAR(120) DEFAULT NULL,
            hide_until_open TINYINT(1) NOT NULL DEFAULT 0,
            allow_reaction TINYINT(1) NOT NULL DEFAULT 1,
            anonymous TINYINT(1) NOT NULL DEFAULT 0,
            scheduled_at TIMESTAMP NULL DEFAULT NULL,
            opened_at TIMESTAMP NULL DEFAULT NULL,
            opened_count INT NOT NULL DEFAULT 0,
            recipient_label VARCHAR(120) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sender (sender_id, created_at),
            INDEX idx_token (token),
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "bot_subscribers": """
        CREATE TABLE IF NOT EXISTS bot_subscribers (
            tg_id BIGINT PRIMARY KEY,
            tg_username VARCHAR(64) DEFAULT NULL,
            first_name VARCHAR(120) DEFAULT NULL,
            lang VARCHAR(8) NOT NULL DEFAULT 'uk',
            picksy_user_id INT DEFAULT NULL,
            is_banned TINYINT(1) NOT NULL DEFAULT 0,
            banned_reason VARCHAR(240) DEFAULT NULL,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_lang (lang),
            INDEX idx_banned (is_banned),
            INDEX idx_picksy_user (picksy_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "bot_subscriptions": """
        CREATE TABLE IF NOT EXISTS bot_subscriptions (
            tg_id BIGINT NOT NULL,
            topic VARCHAR(32) NOT NULL,
            enabled TINYINT(1) NOT NULL DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (tg_id, topic),
            INDEX idx_topic (topic, enabled)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "support_tickets": """
        CREATE TABLE IF NOT EXISTS support_tickets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tg_id BIGINT NOT NULL,
            tg_username VARCHAR(64) DEFAULT NULL,
            category VARCHAR(24) NOT NULL DEFAULT 'other',
            priority VARCHAR(8) NOT NULL DEFAULT 'normal',
            subject VARCHAR(200) DEFAULT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'open',
            tags VARCHAR(255) DEFAULT NULL,
            assigned_admin_tg_id BIGINT DEFAULT NULL,
            admin_chat_msg_id BIGINT DEFAULT NULL,
            close_reason VARCHAR(240) DEFAULT NULL,
            csat_rating TINYINT DEFAULT NULL,
            csat_comment VARCHAR(500) DEFAULT NULL,
            first_reply_at TIMESTAMP NULL DEFAULT NULL,
            auto_close_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            closed_at TIMESTAMP NULL DEFAULT NULL,
            INDEX idx_status (status, updated_at),
            INDEX idx_user (tg_id, status),
            INDEX idx_category (category, status),
            INDEX idx_priority (priority, status),
            INDEX idx_assigned (assigned_admin_tg_id, status),
            INDEX idx_auto_close (auto_close_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "ticket_messages": """
        CREATE TABLE IF NOT EXISTS ticket_messages (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            ticket_id INT NOT NULL,
            author VARCHAR(8) NOT NULL,
            tg_id BIGINT DEFAULT NULL,
            text TEXT DEFAULT NULL,
            file_id VARCHAR(255) DEFAULT NULL,
            file_kind VARCHAR(16) DEFAULT NULL,
            is_internal_note TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ticket (ticket_id, created_at),
            FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "bot_admins": """
        CREATE TABLE IF NOT EXISTS bot_admins (
            tg_id BIGINT PRIMARY KEY,
            display_name VARCHAR(120) DEFAULT NULL,
            role VARCHAR(16) NOT NULL DEFAULT 'support',
            added_by BIGINT DEFAULT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_role (role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "bot_canned_responses": """
        CREATE TABLE IF NOT EXISTS bot_canned_responses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(48) UNIQUE NOT NULL,
            label VARCHAR(120) NOT NULL,
            text TEXT NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "bot_rate_log": """
        CREATE TABLE IF NOT EXISTS bot_rate_log (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            tg_id BIGINT NOT NULL,
            kind VARCHAR(24) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_kind (tg_id, kind, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "duo_matches": """
        CREATE TABLE IF NOT EXISTS duo_matches (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            partner_name VARCHAR(40) DEFAULT NULL,
            role ENUM('creator','joiner') NOT NULL,
            room_code VARCHAR(16) DEFAULT NULL,
            media_type ENUM('movie','tv') NOT NULL DEFAULT 'movie',
            item_id BIGINT DEFAULT NULL,
            title VARCHAR(255) DEFAULT NULL,
            year VARCHAR(8) DEFAULT NULL,
            poster_path VARCHAR(255) DEFAULT NULL,
            vote_average DECIMAL(3,1) DEFAULT NULL,
            match_score INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_time (user_id, created_at),
            INDEX idx_item (media_type, item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "bot_user_messages": """
        CREATE TABLE IF NOT EXISTS bot_user_messages (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            tg_id BIGINT NOT NULL,
            tg_username VARCHAR(64) DEFAULT NULL,
            chat_type VARCHAR(16) DEFAULT NULL,
            kind VARCHAR(24) NOT NULL DEFAULT 'text',
            text TEXT,
            file_id VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_time (tg_id, created_at),
            INDEX idx_time (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "bot_broadcasts": """
        CREATE TABLE IF NOT EXISTS bot_broadcasts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            topic VARCHAR(32) NOT NULL,
            text TEXT NOT NULL,
            button_text VARCHAR(120) DEFAULT NULL,
            button_url VARCHAR(500) DEFAULT NULL,
            photo_file_id VARCHAR(255) DEFAULT NULL,
            sent_count INT NOT NULL DEFAULT 0,
            failed_count INT NOT NULL DEFAULT 0,
            target_count INT NOT NULL DEFAULT 0,
            created_by_tg_id BIGINT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finished_at TIMESTAMP NULL DEFAULT NULL,
            INDEX idx_topic (topic, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "compatibility_matches": """
        CREATE TABLE IF NOT EXISTS compatibility_matches (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            token VARCHAR(64) UNIQUE NOT NULL,
            creator_id INT DEFAULT NULL,
            creator_name VARCHAR(80) DEFAULT 'User 1',
            creator_answers JSON DEFAULT NULL,
            creator_archetype VARCHAR(64) DEFAULT NULL,
            invitee_name VARCHAR(80) DEFAULT NULL,
            invitee_answers JSON DEFAULT NULL,
            invitee_archetype VARCHAR(64) DEFAULT NULL,
            score INT DEFAULT NULL,
            result_payload JSON DEFAULT NULL,
            status ENUM('waiting','completed') NOT NULL DEFAULT 'waiting',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL DEFAULT NULL,
            INDEX idx_token (token),
            INDEX idx_creator (creator_id),
            INDEX idx_status (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    "blog_posts": """
        CREATE TABLE IF NOT EXISTS blog_posts (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            title            VARCHAR(255)  NOT NULL,
            slug             VARCHAR(255)  NOT NULL UNIQUE,
            content          LONGTEXT      NOT NULL,
            excerpt          TEXT,
            cover_image      VARCHAR(500),
            tags             VARCHAR(500)  DEFAULT '',
            content_type     VARCHAR(20)   DEFAULT 'general',
            author_id        INT           DEFAULT NULL,
            is_published     TINYINT(1)    DEFAULT 0,
            is_ai_generated  TINYINT(1)    DEFAULT 0,
            meta_title       VARCHAR(255),
            meta_description VARCHAR(320),
            meta_keywords    VARCHAR(500),
            og_image         VARCHAR(500),
            views            INT           DEFAULT 0,
            created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
            updated_at       DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_slug (slug),
            INDEX idx_published (is_published, created_at),
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
}


def init_db():
    """Create all tables individually so one failure does not block others."""
    try:
        conn = get_db()
    except Exception as e:
        print(f"Database connection failed: {e}")
        print("App will start without DB — auth/stats/favorites will be unavailable until MySQL is ready")
        return

    created, failed = [], []
    with conn.cursor() as cur:
        for name, ddl in TABLES.items():
            try:
                cur.execute(ddl)
                created.append(name)
            except Exception as e:
                failed.append(name)
                print(f"Table '{name}' init warning: {e}")

        # Drop legacy saved_games table if it still exists (best-effort cleanup)
        try:
            cur.execute("DROP TABLE IF EXISTS saved_games")
        except Exception as e:
            print(f"Legacy saved_games cleanup skipped: {e}")

        # Migrations for new features
        migrations = [
            "ALTER TABLE users ADD COLUMN username VARCHAR(64) UNIQUE DEFAULT NULL AFTER email",
            "ALTER TABLE users ADD INDEX idx_username (username)",
            "ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER token",
            "ALTER TABLE users ADD COLUMN is_banned TINYINT(1) NOT NULL DEFAULT 0 AFTER is_admin",
            "ALTER TABLE users ADD COLUMN display_name VARCHAR(80) DEFAULT NULL AFTER username",
            "ALTER TABLE users ADD COLUMN bio VARCHAR(240) DEFAULT NULL AFTER display_name",
            "ALTER TABLE users ADD COLUMN avatar_emoji VARCHAR(16) DEFAULT NULL AFTER bio",
            "ALTER TABLE game_ratings ADD COLUMN game_banned TINYINT(1) NOT NULL DEFAULT 0 AFTER draws",
            "ALTER TABLE game_matches ADD COLUMN guess_deadline TIMESTAMP DEFAULT NULL AFTER round_num",
            "ALTER TABLE users ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER is_banned",
            "ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user' AFTER is_verified",
            "ALTER TABLE game_matches ADD COLUMN lobby_code VARCHAR(16) DEFAULT NULL AFTER guess_deadline",
            "ALTER TABLE game_matches ADD COLUMN is_private TINYINT(1) NOT NULL DEFAULT 0 AFTER lobby_code",
            "ALTER TABLE game_matches ADD INDEX idx_lobby_code (lobby_code)",
            "ALTER TABLE user_subscriptions ADD COLUMN trial_used_at TIMESTAMP NULL DEFAULT NULL AFTER expires_at",
            "ALTER TABLE users ADD COLUMN accepted_privacy TINYINT(1) NOT NULL DEFAULT 0 AFTER role",
            "ALTER TABLE users ADD COLUMN privacy_accepted_at TIMESTAMP NULL DEFAULT NULL AFTER accepted_privacy",
            "ALTER TABLE users ADD COLUMN google_id VARCHAR(255) DEFAULT NULL AFTER privacy_accepted_at",
            "ALTER TABLE users ADD UNIQUE INDEX idx_google_id (google_id)",
            "ALTER TABLE payment_requests ADD COLUMN receipt_id VARCHAR(64) DEFAULT NULL AFTER status",
            "ALTER TABLE payment_requests ADD COLUMN processed_at TIMESTAMP NULL DEFAULT NULL AFTER receipt_id",
            "ALTER TABLE payment_requests ADD INDEX idx_receipt (receipt_id)",
            "ALTER TABLE users ADD COLUMN banner_url VARCHAR(500) DEFAULT NULL AFTER role",
            "ALTER TABLE users ADD COLUMN accent_color VARCHAR(7) DEFAULT NULL AFTER banner_url",
            "ALTER TABLE users ADD COLUMN fav_film_id VARCHAR(64) DEFAULT NULL AFTER accent_color",
            "ALTER TABLE users ADD COLUMN fav_film_title VARCHAR(300) DEFAULT NULL AFTER fav_film_id",
            "ALTER TABLE users ADD COLUMN fav_film_poster VARCHAR(500) DEFAULT NULL AFTER fav_film_title",
            "ALTER TABLE users ADD COLUMN fav_film_type VARCHAR(16) DEFAULT NULL AFTER fav_film_poster",
            "ALTER TABLE users ADD COLUMN fav_film_comment VARCHAR(300) DEFAULT NULL AFTER fav_film_type",
            "ALTER TABLE users ADD COLUMN social_telegram VARCHAR(120) DEFAULT NULL AFTER fav_film_comment",
            "ALTER TABLE users ADD COLUMN social_instagram VARCHAR(120) DEFAULT NULL AFTER social_telegram",
            "ALTER TABLE users ADD COLUMN social_letterboxd VARCHAR(120) DEFAULT NULL AFTER social_instagram",
            "ALTER TABLE users ADD COLUMN social_website VARCHAR(250) DEFAULT NULL AFTER social_letterboxd",
            "ALTER TABLE movie_gifts ADD COLUMN gift_mode VARCHAR(16) NOT NULL DEFAULT 'single' AFTER theme",
            "ALTER TABLE movie_gifts ADD COLUMN max_opens INT NOT NULL DEFAULT 1 AFTER gift_mode",
            "ALTER TABLE movie_gifts ADD COLUMN recipient_name VARCHAR(120) DEFAULT NULL AFTER max_opens",
            "ALTER TABLE movie_gifts ADD COLUMN hide_until_open TINYINT(1) NOT NULL DEFAULT 0 AFTER recipient_name",
            "ALTER TABLE movie_gifts ADD COLUMN allow_reaction TINYINT(1) NOT NULL DEFAULT 1 AFTER hide_until_open",
            "ALTER TABLE movie_gifts ADD COLUMN anonymous TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_reaction",
            # v54 — large banner / avatar data URLs + per-user visibility flags
            "ALTER TABLE users MODIFY COLUMN banner_url MEDIUMTEXT DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN avatar_url MEDIUMTEXT DEFAULT NULL AFTER avatar_emoji",
            "ALTER TABLE users ADD COLUMN show_dna TINYINT(1) NOT NULL DEFAULT 1 AFTER social_website",
            "ALTER TABLE users ADD COLUMN show_psycho TINYINT(1) NOT NULL DEFAULT 1 AFTER show_dna",
            "ALTER TABLE users ADD COLUMN show_zodiac TINYINT(1) NOT NULL DEFAULT 1 AFTER show_psycho",
            "ALTER TABLE users ADD COLUMN show_recs TINYINT(1) NOT NULL DEFAULT 1 AFTER show_zodiac",
            "ALTER TABLE users ADD COLUMN show_top TINYINT(1) NOT NULL DEFAULT 1 AFTER show_recs",
            "ALTER TABLE users ADD COLUMN show_showcase TINYINT(1) NOT NULL DEFAULT 1 AFTER show_top",
            # v55 — store genre names + overview for richer Movie DNA on public profile
            "ALTER TABLE saved_movies ADD COLUMN genres VARCHAR(500) DEFAULT NULL AFTER rating",
            "ALTER TABLE saved_tv ADD COLUMN genres VARCHAR(500) DEFAULT NULL AFTER rating",
            "ALTER TABLE saved_books ADD COLUMN genres VARCHAR(500) DEFAULT NULL AFTER rating",
            # v84 — hashed bearer tokens + expiry timestamp. Existing rows hold
            # raw 64-char urlsafe tokens; sha256 is also 64 hex chars so the
            # column width still fits.
            "ALTER TABLE users ADD COLUMN token_issued_at TIMESTAMP NULL DEFAULT NULL AFTER token",
        ]
        for m in migrations:
            try:
                cur.execute(m)
            except Exception:
                pass  # column/index already exists

        # v84 — one-time invalidation of legacy plaintext tokens. Tokens that
        # don't look like a sha256 hex digest (64 lowercase hex chars) are
        # cleared so every session resumes via the hashed path going forward.
        try:
            cur.execute(
                "UPDATE users SET token = NULL "
                "WHERE token IS NOT NULL "
                "AND (CHAR_LENGTH(token) <> 64 OR token REGEXP '[^0-9a-f]')"
            )
            conn.commit()
        except Exception:
            pass

        # Default settings
        try:
            for key, value in DEFAULT_SITE_SETTINGS.items():
                cur.execute("INSERT IGNORE INTO site_settings (name, value) VALUES (%s, %s)", (key, _serialize_setting_value(value)))
        except Exception as e:
            print(f"Default settings skipped: {e}")

        # Default admins
        try:
            cur.execute("UPDATE users SET is_admin = 1 WHERE email = %s AND is_admin = 0", ("ghoulghoul1007@gmail.com",))
            conn.commit()
        except Exception:
            pass
    conn.close()

    if failed:
        print(f"DB init: created={created}, failed={failed}")
        print("Some features may be unavailable — check MySQL logs for details")
    else:
        print(f"Database initialized successfully: {created}")
