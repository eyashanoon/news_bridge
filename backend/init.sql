CREATE DATABASE IF NOT EXISTS news_crawler;
CREATE DATABASE IF NOT EXISTS news_crawler_new;

GRANT ALL PRIVILEGES ON news_crawler_new.* TO 'news_user'@'%';
GRANT ALL PRIVILEGES ON news_crawler.* TO 'news_user'@'%';

FLUSH PRIVILEGES;