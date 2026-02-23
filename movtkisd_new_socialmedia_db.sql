-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Feb 10, 2026 at 02:31 PM
-- Server version: 11.4.9-MariaDB-cll-lve-log
-- PHP Version: 8.3.29

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `movtkisd_new_socialmedia_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `analytics`
--

CREATE TABLE `analytics` (
  `id` bigint(20) NOT NULL,
  `platform` varchar(20) NOT NULL,
  `metric_type` varchar(30) NOT NULL,
  `metric_value` int(11) NOT NULL,
  `recorded_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `post_id` bigint(20) DEFAULT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auth_group`
--

CREATE TABLE `auth_group` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `auth_group`
--

INSERT INTO `auth_group` (`id`, `name`) VALUES
(1, 'Group1');

-- --------------------------------------------------------

--
-- Table structure for table `auth_group_permissions`
--

CREATE TABLE `auth_group_permissions` (
  `id` bigint(20) NOT NULL,
  `group_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auth_permission`
--

CREATE TABLE `auth_permission` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `content_type_id` int(11) NOT NULL,
  `codename` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `auth_permission`
--

INSERT INTO `auth_permission` (`id`, `name`, `content_type_id`, `codename`) VALUES
(1, 'Can add log entry', 1, 'add_logentry'),
(2, 'Can change log entry', 1, 'change_logentry'),
(3, 'Can delete log entry', 1, 'delete_logentry'),
(4, 'Can view log entry', 1, 'view_logentry'),
(5, 'Can add permission', 2, 'add_permission'),
(6, 'Can change permission', 2, 'change_permission'),
(7, 'Can delete permission', 2, 'delete_permission'),
(8, 'Can view permission', 2, 'view_permission'),
(9, 'Can add group', 3, 'add_group'),
(10, 'Can change group', 3, 'change_group'),
(11, 'Can delete group', 3, 'delete_group'),
(12, 'Can view group', 3, 'view_group'),
(13, 'Can add user', 4, 'add_user'),
(14, 'Can change user', 4, 'change_user'),
(15, 'Can delete user', 4, 'delete_user'),
(16, 'Can view user', 4, 'view_user'),
(17, 'Can add content type', 5, 'add_contenttype'),
(18, 'Can change content type', 5, 'change_contenttype'),
(19, 'Can delete content type', 5, 'delete_contenttype'),
(20, 'Can view content type', 5, 'view_contenttype'),
(21, 'Can add session', 6, 'add_session'),
(22, 'Can change session', 6, 'change_session'),
(23, 'Can delete session', 6, 'delete_session'),
(24, 'Can view session', 6, 'view_session'),
(25, 'Can add User Profile', 7, 'add_userprofile'),
(26, 'Can change User Profile', 7, 'change_userprofile'),
(27, 'Can delete User Profile', 7, 'delete_userprofile'),
(28, 'Can view User Profile', 7, 'view_userprofile'),
(29, 'Can add Social Account', 8, 'add_socialaccount'),
(30, 'Can change Social Account', 8, 'change_socialaccount'),
(31, 'Can delete Social Account', 8, 'delete_socialaccount'),
(32, 'Can view Social Account', 8, 'view_socialaccount'),
(33, 'Can add Post', 9, 'add_post'),
(34, 'Can change Post', 9, 'change_post'),
(35, 'Can delete Post', 9, 'delete_post'),
(36, 'Can view Post', 9, 'view_post'),
(37, 'Can add Analytics', 10, 'add_analytics'),
(38, 'Can change Analytics', 10, 'change_analytics'),
(39, 'Can delete Analytics', 10, 'delete_analytics'),
(40, 'Can view Analytics', 10, 'view_analytics'),
(41, 'Can add Site Configuration', 11, 'add_siteconfiguration'),
(42, 'Can change Site Configuration', 11, 'change_siteconfiguration'),
(43, 'Can delete Site Configuration', 11, 'delete_siteconfiguration'),
(44, 'Can view Site Configuration', 11, 'view_siteconfiguration');

-- --------------------------------------------------------

--
-- Table structure for table `auth_user`
--

CREATE TABLE `auth_user` (
  `id` int(11) NOT NULL,
  `password` varchar(128) NOT NULL,
  `last_login` datetime(6) DEFAULT NULL,
  `is_superuser` tinyint(1) NOT NULL,
  `username` varchar(150) NOT NULL,
  `first_name` varchar(150) NOT NULL,
  `last_name` varchar(150) NOT NULL,
  `email` varchar(254) NOT NULL,
  `is_staff` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `date_joined` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `auth_user`
--

INSERT INTO `auth_user` (`id`, `password`, `last_login`, `is_superuser`, `username`, `first_name`, `last_name`, `email`, `is_staff`, `is_active`, `date_joined`) VALUES
(2, 'pbkdf2_sha256$600000$KhxJvgkLy5STpC3Q6ZLJfQ$hn2T7L+k5UhMcsH6/zIo3VL+n4FuSjg7cM+iC0Qjt98=', '2025-12-22 12:43:02.000000', 1, 'admin1', '', '', 'admin1@admin.com', 1, 1, '2025-12-20 09:52:48.000000'),
(3, 'pbkdf2_sha256$600000$kLfEX4twyM2kiAxYVGaAIj$HvCLW/k5Xl+DUtfkDcA+SZehvaw1HSyaeB0rCCKdTOA=', '2025-12-23 09:39:22.991779', 0, 'Aaa', '', '', 'a@a.com', 0, 1, '2025-12-20 10:50:43.435000'),
(4, 'pbkdf2_sha256$600000$UvHtxWxCZV7mPeFymc8PRV$TIZWt3JyoHpvkK+Hgx4G6RAI+unsAk2Yta/H/hE3sWY=', '2025-12-23 05:00:54.000000', 1, 'abedintech', 'Arifuzzaman', 'Swapnil', 'abedintech.04@gmail.com', 1, 1, '2025-12-23 04:51:53.000000'),
(5, 'pbkdf2_sha256$600000$DumXyFqsBCMAs7EkAezEdN$X8/mtLhNEBxAPSiVWTl+NGdpUYEHEv3aNRy0CifR3gM=', '2025-12-23 09:37:02.815702', 0, 'abedintradepoint', '', '', 'abedintradepoint68@gmail.com', 0, 1, '2025-12-23 09:35:45.858403');

-- --------------------------------------------------------

--
-- Table structure for table `auth_user_groups`
--

CREATE TABLE `auth_user_groups` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `auth_user_groups`
--

INSERT INTO `auth_user_groups` (`id`, `user_id`, `group_id`) VALUES
(1, 2, 1),
(2, 4, 1);

-- --------------------------------------------------------

--
-- Table structure for table `auth_user_user_permissions`
--

CREATE TABLE `auth_user_user_permissions` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `auth_user_user_permissions`
--

INSERT INTO `auth_user_user_permissions` (`id`, `user_id`, `permission_id`) VALUES
(1, 2, 1),
(2, 2, 2),
(3, 2, 3),
(4, 2, 4),
(5, 2, 5),
(6, 2, 6),
(7, 2, 7),
(8, 2, 8),
(9, 2, 9),
(10, 2, 10),
(11, 2, 11),
(12, 2, 12),
(13, 2, 13),
(14, 2, 14),
(15, 2, 15),
(16, 2, 16),
(17, 2, 17),
(18, 2, 18),
(19, 2, 19),
(20, 2, 20),
(21, 2, 21),
(22, 2, 22),
(23, 2, 23),
(24, 2, 24),
(25, 2, 25),
(26, 2, 26),
(27, 2, 27),
(28, 2, 28),
(29, 2, 29),
(30, 2, 30),
(31, 2, 31),
(32, 2, 32),
(33, 2, 33),
(34, 2, 34),
(35, 2, 35),
(36, 2, 36),
(37, 2, 37),
(38, 2, 38),
(39, 2, 39),
(40, 2, 40),
(41, 2, 41),
(42, 2, 42),
(43, 2, 43),
(44, 2, 44),
(45, 4, 1),
(46, 4, 2),
(47, 4, 3),
(48, 4, 4),
(49, 4, 5),
(50, 4, 6),
(51, 4, 7),
(52, 4, 8),
(53, 4, 9),
(54, 4, 10),
(55, 4, 11),
(56, 4, 12),
(57, 4, 13),
(58, 4, 14),
(59, 4, 15),
(60, 4, 16),
(61, 4, 17),
(62, 4, 18),
(63, 4, 19),
(64, 4, 20),
(65, 4, 21),
(66, 4, 22),
(67, 4, 23),
(68, 4, 24),
(69, 4, 25),
(70, 4, 26),
(71, 4, 27),
(72, 4, 28),
(73, 4, 29),
(74, 4, 30),
(75, 4, 31),
(76, 4, 32),
(77, 4, 33),
(78, 4, 34),
(79, 4, 35),
(80, 4, 36),
(81, 4, 37),
(82, 4, 38),
(83, 4, 39),
(84, 4, 40),
(85, 4, 41),
(86, 4, 42),
(87, 4, 43),
(88, 4, 44);

-- --------------------------------------------------------

--
-- Table structure for table `django_admin_log`
--

CREATE TABLE `django_admin_log` (
  `id` int(11) NOT NULL,
  `action_time` datetime(6) NOT NULL,
  `object_id` longtext DEFAULT NULL,
  `object_repr` varchar(200) NOT NULL,
  `action_flag` smallint(5) UNSIGNED NOT NULL CHECK (`action_flag` >= 0),
  `change_message` longtext NOT NULL,
  `content_type_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `django_admin_log`
--

INSERT INTO `django_admin_log` (`id`, `action_time`, `object_id`, `object_repr`, `action_flag`, `change_message`, `content_type_id`, `user_id`) VALUES
(1, '2025-12-20 10:42:42.378000', '1', 'admin1 - Facebook (Aa)', 1, '[{\"added\": {}}]', 8, 2),
(2, '2025-12-20 10:51:40.796000', '1', 'Aaa - Pending', 2, '[{\"changed\": {\"fields\": [\"Max social accounts\"]}}]', 7, 2),
(3, '2025-12-20 10:53:01.753000', '1', 'Aaa - Pending', 2, '[{\"changed\": {\"fields\": [\"Subscription plan\"]}}]', 7, 2),
(4, '2025-12-20 10:53:15.428000', '1', 'Aaa - Approved', 2, '[{\"changed\": {\"fields\": [\"Is approved\", \"Subscription plan\"]}}]', 7, 2),
(5, '2025-12-22 05:16:55.925000', '1', 'Aaa - Approved', 2, '[{\"changed\": {\"fields\": [\"Subscription plan\", \"Max posts per month\"]}}]', 7, 2),
(6, '2025-12-22 05:19:17.042000', '2', 'admin1 - Pending', 2, '[{\"changed\": {\"fields\": [\"Subscription plan\", \"Max social accounts\", \"Max posts per month\"]}}]', 7, 2),
(7, '2025-12-22 05:19:25.921000', '2', 'admin1 - Approved', 2, '[{\"changed\": {\"fields\": [\"Is approved\"]}}]', 7, 2),
(8, '2025-12-22 12:44:15.736403', '3', 'Aaa - Approved', 2, '[{\"changed\": {\"fields\": [\"Is approved\"]}}]', 7, 2),
(9, '2025-12-22 12:50:55.265795', '2', 'admin1 - Approved', 2, '[{\"changed\": {\"fields\": [\"Is approved\"]}}]', 7, 2),
(10, '2025-12-23 04:50:25.666408', '1', 'admin - Approved', 2, '[{\"changed\": {\"fields\": [\"Is approved\"]}}]', 7, 2),
(11, '2025-12-23 04:51:54.131905', '4', 'abedintech', 1, '[{\"added\": {}}]', 4, 2),
(12, '2025-12-23 04:52:42.334808', '4', 'abedintech', 2, '[{\"changed\": {\"fields\": [\"First name\", \"Last name\", \"Email address\", \"Staff status\", \"Superuser status\"]}}]', 4, 2),
(13, '2025-12-23 04:55:55.412422', '4', 'abedintech - Approved', 2, '[{\"changed\": {\"fields\": [\"Is approved\", \"Subscription plan\", \"Max social accounts\", \"Max posts per month\"]}}]', 7, 2),
(14, '2025-12-23 04:58:16.714256', '1', 'Group1', 1, '[{\"added\": {}}]', 3, 2),
(15, '2025-12-23 05:00:14.843043', '2', 'admin1', 2, '[{\"changed\": {\"fields\": [\"Groups\", \"User permissions\"]}}]', 4, 2),
(16, '2025-12-23 05:00:43.156275', '4', 'abedintech', 2, '[{\"changed\": {\"fields\": [\"Groups\", \"User permissions\"]}}]', 4, 2),
(17, '2025-12-23 05:01:33.722052', '1', 'admin', 3, '', 4, 2),
(18, '2025-12-23 05:02:22.174229', '4', 'abedintech', 2, '[]', 4, 4),
(19, '2025-12-23 09:36:37.128605', '5', 'abedintradepoint - Approved', 2, '[{\"changed\": {\"fields\": [\"Is approved\"]}}]', 7, 2),
(20, '2025-12-23 09:56:51.315687', '3', 'Aaa - Approved', 2, '[{\"changed\": {\"fields\": [\"Subscription plan\", \"Max social accounts\", \"Max posts per month\", \"Posts this month\"]}}]', 7, 2);

-- --------------------------------------------------------

--
-- Table structure for table `django_content_type`
--

CREATE TABLE `django_content_type` (
  `id` int(11) NOT NULL,
  `app_label` varchar(100) NOT NULL,
  `model` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `django_content_type`
--

INSERT INTO `django_content_type` (`id`, `app_label`, `model`) VALUES
(11, 'accounts', 'siteconfiguration'),
(7, 'accounts', 'userprofile'),
(1, 'admin', 'logentry'),
(10, 'analytics', 'analytics'),
(3, 'auth', 'group'),
(2, 'auth', 'permission'),
(4, 'auth', 'user'),
(5, 'contenttypes', 'contenttype'),
(8, 'platforms', 'socialaccount'),
(9, 'posts', 'post'),
(6, 'sessions', 'session');

-- --------------------------------------------------------

--
-- Table structure for table `django_migrations`
--

CREATE TABLE `django_migrations` (
  `id` bigint(20) NOT NULL,
  `app` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `applied` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `django_migrations`
--

INSERT INTO `django_migrations` (`id`, `app`, `name`, `applied`) VALUES
(1, 'contenttypes', '0001_initial', '2025-12-22 10:00:09.307908'),
(2, 'auth', '0001_initial', '2025-12-22 10:00:09.917530'),
(3, 'accounts', '0001_initial', '2025-12-22 10:00:10.015468'),
(4, 'admin', '0001_initial', '2025-12-22 10:00:10.131396'),
(5, 'admin', '0002_logentry_remove_auto_add', '2025-12-22 10:00:10.146389'),
(6, 'admin', '0003_logentry_add_action_flag_choices', '2025-12-22 10:00:10.157381'),
(7, 'posts', '0001_initial', '2025-12-22 10:00:10.231336'),
(8, 'analytics', '0001_initial', '2025-12-22 10:00:10.385239'),
(9, 'contenttypes', '0002_remove_content_type_name', '2025-12-22 10:00:10.492287'),
(10, 'auth', '0002_alter_permission_name_max_length', '2025-12-22 10:00:10.557246'),
(11, 'auth', '0003_alter_user_email_max_length', '2025-12-22 10:00:10.580232'),
(12, 'auth', '0004_alter_user_username_opts', '2025-12-22 10:00:10.593223'),
(13, 'auth', '0005_alter_user_last_login_null', '2025-12-22 10:00:10.676171'),
(14, 'auth', '0006_require_contenttypes_0002', '2025-12-22 10:00:10.693162'),
(15, 'auth', '0007_alter_validators_add_error_messages', '2025-12-22 10:00:10.732137'),
(16, 'auth', '0008_alter_user_username_max_length', '2025-12-22 10:00:10.768115'),
(17, 'auth', '0009_alter_user_last_name_max_length', '2025-12-22 10:00:10.833075'),
(18, 'auth', '0010_alter_group_name_max_length', '2025-12-22 10:00:10.858059'),
(19, 'auth', '0011_update_proxy_permissions', '2025-12-22 10:00:10.870052'),
(20, 'auth', '0012_alter_user_first_name_max_length', '2025-12-22 10:00:10.901032'),
(21, 'platforms', '0001_initial', '2025-12-22 10:00:11.063931'),
(22, 'platforms', '0002_remove_socialaccount_access_token_and_more', '2025-12-22 10:00:11.480672'),
(23, 'sessions', '0001_initial', '2025-12-22 10:00:11.558623'),
(24, 'accounts', '0002_siteconfiguration', '2025-12-22 12:18:29.602152');

-- --------------------------------------------------------

--
-- Table structure for table `django_session`
--

CREATE TABLE `django_session` (
  `session_key` varchar(40) NOT NULL,
  `session_data` longtext NOT NULL,
  `expire_date` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `django_session`
--

INSERT INTO `django_session` (`session_key`, `session_data`, `expire_date`) VALUES
('36p2z470ozc1zo81lh6fie8vuh3oitn7', 'e30:1vWuVZ:U3FXyko8ztQJvozVV752lGw-KBspG70naHN1aCYwK4c', '2026-01-03 10:48:21.748000'),
('3vqtrt4qqk8lzfwovxpzccic94lvyw26', '.eJxVjDsOwyAQBe9CbSF-tiFl-pwBLewSnEQgGbuKcvcEyUXcvpl5b-Zh37LfG61-QXZhmg3_W4D4pNIBPqDcK4-1bOsSeFf4QRu_VaTX9XBPBxla_tUWIhqE5LSIktAhJmkt0ASTTUYYBUGhmh1ImpG0IBHHLgkyozIpsc8XGSE5Iw:1vXuYz:AadlL-mLgJl789yGyrEtdRR6Nz6C8_iDd6KQXfQI_R8', '2026-01-06 05:04:01.604331'),
('5la8v9gz04x9vswim8fku9uwmp561uq8', 'e30:1vXY6l:78qRZFfibMs3qe_CiosMqMLTWPahJy3QqByQTOzRO1s', '2026-01-05 05:05:23.957000'),
('6wgixyyw8z4anqn58zy6rqznww1mn7uy', 'e30:1vXY5x:HtG67HeqdnxhxMluyHVq_H71bEiV8MY6TWkoAH0cZzQ', '2026-01-05 05:04:33.184000'),
('7rfqtq09trxeeiwq30925yy7cmb6nmo2', 'e30:1vXBA6:eWsgKNupnlt40iW1kNz5R0CCbIt2Q-zMHv2QMLud10U', '2026-01-04 04:35:18.988000'),
('85rksx9c4qful9as561lhr5xs6kvtb7h', 'e30:1vXXvx:E3FtzXZt9HWfDZrEg-iXPDlPdvYmAMYV0jSmAig4ueg', '2026-01-05 04:54:13.468000'),
('elpr1kl1v0k9i9mr6djm0cg6tvwev2im', 'e30:1vXY6D:JdLQwrr9AHD1Fuwp2-zKmHJFNfyfoDQ2vXXNFh1fAUQ', '2026-01-05 05:04:49.201000'),
('gsnmd54qocgs10ef86y3rt7mo1tzlz8k', 'e30:1vXXxa:eN7mzCzUcVbUPpsblU3eX4m4az4aUfr3v8BVrMxAZa8', '2026-01-05 04:55:54.590000'),
('hibsz49fee7mb7dwpx8o718y95i2w1yp', '.eJxVjMsOwiAQRf-FtSEzpTDg0n2_gfAYpWogKe3K-O_apAvd3nPOfQkftrX4rfPi5yzOQonT7xZDenDdQb6Hemsytbouc5S7Ig_a5dQyPy-H-3dQQi_fOhgCG7XODMoR24QjkFMRCNMATiGApkhWm9E4Hp2GgPGKnHLKelAo3h-xHTas:1vXCZ6:mUK9bySuHVM5U9uDL9pW4LAwq25-dNMkC6jAZb4i61Y', '2026-01-04 06:05:12.717000'),
('ij7n7lswrhc0m2ib6aym7b0v5a6jtj0i', '.eJxVjMsOwiAQRf-FtSEzpTDg0n2_gfAYpWogKe3K-O_apAvd3nPOfQkftrX4rfPi5yzOQonT7xZDenDdQb6Hemsytbouc5S7Ig_a5dQyPy-H-3dQQi_fOhgCG7XODMoR24QjkFMRCNMATiGApkhWm9E4Hp2GgPGKnHLKelAo3h-xHTas:1vWuaV:Ms5Bj9RKqGrtuImK1oVUgRjDWkRDfZTEsJNZvvZb_gI', '2026-01-03 10:53:27.882000'),
('ivavmk3yr4ojl1j2v7d9s1xwq2bpb0q9', 'e30:1vXXyD:7B_qunKMXt86ThfiKNwGLtvuyrAMjgGLDP4IJ2ndi_w', '2026-01-05 04:56:33.268000'),
('jip7vez5mdu5nlto6k4wo6bf1toeulsp', '.eJxVjEEOwiAQRe_C2pCCUBiX7nsGwjCDVA0kpV0Z765NutDtf-_9lwhxW0vYOi9hJnERWpx-N4zpwXUHdI_11mRqdV1mlLsiD9rl1Iif18P9Oyixl29tzghIlpxn8tkYHMBFgJGcMdl7yIgWchyYmFPyqJ1WgKNGUqDQW_H-AP30OIs:1vXYHQ:4scSxCA0opiqnUJX4z6Qsw72JjxIsDb3Z93l_gMjM_s', '2026-01-05 05:16:24.982000'),
('kb4u9un4gbmjrepwphifpv280asvr4yz', '.eJxVjEEOwiAQAP_C2ZAKLBSP3vsGsgurVA0kpT01_bsh6UGvM5PZRcBtzWFrvIQ5iZsw4vLLCOObSxfpheVZZaxlXWaSPZGnbXKqiT_3s_0bZGy5b2GIDnGM2lgNxOw9wdWRTQrYsLJu8JiANLuH0aAQrQdF3o5MGiCK4wveszey:1vXuVy:48867PR-Eg3ib8Vvy_sb6No41BIb3yoQH_5Q87f_DPU', '2026-01-06 05:00:54.445833'),
('l8kq7v08bisnb5j2uv4mqfwj8acrhd3l', '.eJxVjDsOwyAQBe9CbSF-tiFl-pwBLewSnEQgGbuKcvcEyUXcvpl5b-Zh37LfG61-QXZhmg3_W4D4pNIBPqDcK4-1bOsSeFf4QRu_VaTX9XBPBxla_tUWIhqE5LSIktAhJmkt0ASTTUYYBUGhmh1ImpG0IBHHLgkyozIpsc8XGSE5Iw:1vXfGy:zXP4S2o8MF7-URuG0EUpji4y3F_eHfr4v5zKfOc1vGQ', '2026-01-05 12:44:24.175808'),
('nd6mx6sqw6y5hnq25e6nw1ucr0texzzn', '.eJxVjEEOwiAQRe_C2hCYlIG6dO8ZyDBMpWogKe3KeHdt0oVu_3vvv1SkbS1x67LEOauzAnX63RLxQ-oO8p3qrWludV3mpHdFH7Tra8vyvBzu30GhXr41osM8kWUxMCIHcWSC8cGSM5zATSMMKThGzwiSIA8BKLHHAdkLW_X-ANvON9Q:1vXfFe:bOX9Zr_WTAm5DstVTVgi_HAHNQO9x88FvmEZaPA5xcc', '2026-01-05 12:43:02.552127'),
('rzc4zd6sb74p88a7otwp4zwnm8fslu1o', '.eJxVjMsOwiAQRf-FtSEzpTDg0n2_gfAYpWogKe3K-O_apAvd3nPOfQkftrX4rfPi5yzOQonT7xZDenDdQb6Hemsytbouc5S7Ig_a5dQyPy-H-3dQQi_fOhgCG7XODMoR24QjkFMRCNMATiGApkhWm9E4Hp2GgPGKnHLKelAo3h-xHTas:1vWvfG:H3gb1NqB2tHdaMbiA23Ffuajg_wXhIfqinSKwjvsUAg', '2026-01-03 12:02:26.390000'),
('uqwxp2ynzpv7rcdo2useiqxfn3qpns7i', '.eJxVjMsOwiAQRf-FtSEzpTDg0n2_gfAYpWogKe3K-O_apAvd3nPOfQkftrX4rfPi5yzOQonT7xZDenDdQb6Hemsytbouc5S7Ig_a5dQyPy-H-3dQQi_fOhgCG7XODMoR24QjkFMRCNMATiGApkhWm9E4Hp2GgPGKnHLKelAo3h-xHTas:1vXIx2:XTNcvVD_v7s_RjvgmxrKLZLecqcMDHeaV9fx5dU1a7k', '2026-01-04 12:54:20.651000'),
('xy1ecun1zvxdk5s4q8h1fctph3ze9lsc', '.eJxVjDsOwyAQBe9CbSF-tiFl-pwBLewSnEQgGbuKcvcEyUXcvpl5b-Zh37LfG61-QXZhmg3_W4D4pNIBPqDcK4-1bOsSeFf4QRu_VaTX9XBPBxla_tUWIhqE5LSIktAhJmkt0ASTTUYYBUGhmh1ImpG0IBHHLgkyozIpsc8XGSE5Iw:1vXyrS:qvCFe7MAZzcw38m9PdVHHUULIi_BcCZ6NZV_4jOvmSg', '2026-01-06 09:39:22.995129');

-- --------------------------------------------------------

--
-- Table structure for table `posts`
--

CREATE TABLE `posts` (
  `id` bigint(20) NOT NULL,
  `caption` longtext NOT NULL,
  `ai_generated` tinyint(1) NOT NULL,
  `media_files` longtext NOT NULL,
  `scheduled_time` datetime(6) NOT NULL,
  `timezone` varchar(50) NOT NULL,
  `platforms` longtext NOT NULL,
  `status` varchar(20) NOT NULL,
  `facebook_post_id` varchar(200) DEFAULT NULL,
  `twitter_post_id` varchar(200) DEFAULT NULL,
  `instagram_post_id` varchar(200) DEFAULT NULL,
  `linkedin_post_id` varchar(200) DEFAULT NULL,
  `tiktok_post_id` varchar(200) DEFAULT NULL,
  `youtube_post_id` varchar(200) DEFAULT NULL,
  `pinterest_post_id` varchar(200) DEFAULT NULL,
  `telegram_post_id` varchar(200) DEFAULT NULL,
  `facebook_error` longtext DEFAULT NULL,
  `twitter_error` longtext DEFAULT NULL,
  `instagram_error` longtext DEFAULT NULL,
  `linkedin_error` longtext DEFAULT NULL,
  `tiktok_error` longtext DEFAULT NULL,
  `youtube_error` longtext DEFAULT NULL,
  `pinterest_error` longtext DEFAULT NULL,
  `telegram_error` longtext DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `posted_at` datetime(6) DEFAULT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `posts`
--

INSERT INTO `posts` (`id`, `caption`, `ai_generated`, `media_files`, `scheduled_time`, `timezone`, `platforms`, `status`, `facebook_post_id`, `twitter_post_id`, `instagram_post_id`, `linkedin_post_id`, `tiktok_post_id`, `youtube_post_id`, `pinterest_post_id`, `telegram_post_id`, `facebook_error`, `twitter_error`, `instagram_error`, `linkedin_error`, `tiktok_error`, `youtube_error`, `pinterest_error`, `telegram_error`, `created_at`, `updated_at`, `posted_at`, `user_id`) VALUES
(34, 'hhhhhhhhhhhhhhhh', 0, '[\"posts/3/1766320504.165559.mp4\"]', '2025-12-21 12:36:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"linkedin\"]', 'posted', '897917125922156', NULL, NULL, 'urn:li:share:7408485694802698240', NULL, NULL, NULL, NULL, NULL, NULL, 'Instagram only supports images (.jpg, .png). Video not supported via API.', NULL, NULL, NULL, NULL, NULL, '2025-12-21 12:35:04.258000', '2025-12-21 12:37:13.789000', '2025-12-21 12:37:13.789000', 3),
(35, 'aaaaaaaaaaaaaaaa', 0, '[\"posts/3/1766320548.0312.jpg\"]', '2025-12-21 12:36:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"linkedin\"]', 'posted', '122115100623011938', NULL, NULL, 'urn:li:share:7408485736150405120', NULL, NULL, NULL, NULL, NULL, NULL, 'Only photo or video can be accepted as media type.', NULL, NULL, NULL, NULL, NULL, '2025-12-21 12:35:48.047000', '2025-12-21 12:37:23.725000', '2025-12-21 12:37:23.725000', 3),
(36, 'aaaaaaaaaaaaaaaa', 0, '[\"posts/3/1766320548.063987.jpg\"]', '2025-12-21 12:36:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"linkedin\"]', 'posted', '122115100683011938', NULL, NULL, 'urn:li:share:7408485787006226432', NULL, NULL, NULL, NULL, NULL, NULL, 'Only photo or video can be accepted as media type.', NULL, NULL, NULL, NULL, NULL, '2025-12-21 12:35:48.066000', '2025-12-21 12:37:41.038000', '2025-12-21 12:37:41.038000', 3),
(37, 'ihihihih', 0, '[\"posts/3/1766321010.135304.png\"]', '2025-12-21 12:44:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"linkedin\"]', 'posted', '122115101715011938', NULL, NULL, 'urn:li:share:7408487676313788416', NULL, NULL, NULL, NULL, NULL, NULL, 'Only photo or video can be accepted as media type.', NULL, NULL, NULL, NULL, NULL, '2025-12-21 12:43:30.138000', '2025-12-21 12:45:25.106000', '2025-12-21 12:45:25.106000', 3),
(38, 'aaa', 0, '[\"posts/3/1766321427.561902.jpg\"]', '2025-12-21 12:51:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"linkedin\"]', 'posted', '122115102687011938', NULL, NULL, 'urn:li:share:7408489245189009408', NULL, NULL, NULL, NULL, NULL, NULL, 'Facebook upload failed: Unsupported post request. Object with ID \'None\' does not exist, cannot be loaded due to missing permissions, or does not support this operation. Please read the Graph API documentation at https://developers.facebook.com/docs/graph-api', NULL, NULL, NULL, NULL, NULL, '2025-12-21 12:50:27.565000', '2025-12-21 12:51:20.385000', '2025-12-21 12:51:20.385000', 3),
(39, 'hi6', 0, '[\"posts/3/1766380643.160849.jpg\"]', '2025-12-22 05:19:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"linkedin\"]', 'posted', '122115169185011938', NULL, '18036346367755740', 'urn:li:share:7408738169724112896', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 05:17:23.166000', '2025-12-22 05:20:28.281000', '2025-12-22 05:20:28.281000', 3),
(40, 'video6', 0, '[]', '2025-12-22 05:22:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"linkedin\"]', 'posted', '754646057738376_122115169437011938', NULL, NULL, 'urn:li:share:7408738798903144449', NULL, NULL, NULL, NULL, NULL, NULL, 'Instagram requires image', NULL, NULL, NULL, NULL, NULL, '2025-12-22 05:21:03.037000', '2025-12-22 05:22:58.237000', '2025-12-22 05:22:58.237000', 3),
(41, 'Video7', 0, '[\"posts/3/1766381625.090021.mp4\"]', '2025-12-22 05:34:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"linkedin\"]', 'posted', '1493708818398723', NULL, NULL, 'urn:li:share:7408741832047808512', NULL, NULL, NULL, NULL, NULL, NULL, 'Instagram only supports images (.jpg, .png)', NULL, NULL, NULL, NULL, NULL, '2025-12-22 05:33:45.172000', '2025-12-22 05:35:01.360000', '2025-12-22 05:35:01.360000', 3),
(42, 'img5', 0, '[\"posts/3/1766381716.116935.png\"]', '2025-12-22 05:36:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"linkedin\"]', 'posted', '122115170865011938', NULL, '18066816590385312', 'urn:li:share:7408742413042683904', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 05:35:16.116000', '2025-12-22 05:37:19.969000', '2025-12-22 05:37:19.969000', 3),
(43, 'img7', 0, '[\"posts/3/1766382180.579432.jpg\"]', '2025-12-22 05:44:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"linkedin\"]', 'posted', '122115171423011938', NULL, '18055419800674111', 'urn:li:share:7408744424966651904', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 05:43:00.579000', '2025-12-22 05:45:19.660000', '2025-12-22 05:45:19.660000', 3),
(44, 'video', 0, '[\"posts/3/1766382203.331052.mp4\"]', '2025-12-22 05:44:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"linkedin\"]', 'posted', '1217680080246932', NULL, NULL, 'urn:li:share:7408744820002787328', NULL, NULL, NULL, NULL, NULL, NULL, 'Instagram media processing failed', NULL, NULL, NULL, NULL, NULL, '2025-12-22 05:43:23.340000', '2025-12-22 05:46:53.726000', '2025-12-22 05:46:53.726000', 3),
(45, 'v8', 0, '[\"posts/3/1766382980.34684.mp4\"]', '2025-12-22 05:58:00.000000', 'UTC', '[\"twitter\", \"instagram\", \"facebook\", \"linkedin\"]', 'posted', '25717161091306014', NULL, NULL, 'urn:li:share:7408748257717227520', NULL, NULL, NULL, NULL, NULL, 'type object \'TwitterService\' has no attribute \'post_to_twitter\'', 'Instagram media processing failed', NULL, NULL, NULL, NULL, NULL, '2025-12-22 05:56:20.356000', '2025-12-22 06:00:33.380000', '2025-12-22 06:00:33.379000', 3),
(46, 'i8', 0, '[\"posts/3/1766383006.912333.jpg\"]', '2025-12-22 05:58:00.000000', 'UTC', '[\"twitter\", \"instagram\", \"facebook\", \"linkedin\"]', 'posted', '122115172803011938', NULL, '18371731354085644', 'urn:li:share:7408748398432071680', NULL, NULL, NULL, NULL, NULL, 'type object \'TwitterService\' has no attribute \'post_to_twitter\'', NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 05:56:46.915000', '2025-12-22 06:01:06.999000', '2025-12-22 06:01:06.999000', 3),
(47, '123', 0, '[\"posts/3/1766383536.721508.png\"]', '2025-12-22 06:06:00.000000', 'UTC', '[\"twitter\", \"instagram\", \"facebook\", \"linkedin\"]', 'posted', '122115173223011938', '2002984018242142211', '18329144677246544', 'urn:li:share:7408749851863056384', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 06:05:36.724000', '2025-12-22 06:06:53.526000', '2025-12-22 06:06:53.525000', 3),
(48, 'v123', 0, '[\"posts/3/1766383563.590969.mp4\"]', '2025-12-22 06:06:00.000000', 'UTC', '[\"twitter\", \"instagram\", \"facebook\", \"linkedin\"]', 'posted', '1582109699480812', '2002984228292870270', NULL, 'urn:li:share:7408750364658663425', NULL, NULL, NULL, NULL, NULL, NULL, 'Instagram media processing failed', NULL, NULL, NULL, NULL, NULL, '2025-12-22 06:06:03.598000', '2025-12-22 06:08:55.688000', '2025-12-22 06:08:55.688000', 3),
(49, '3.3', 0, '[\"posts/3/1766383867.363127.mp4\"]', '2025-12-22 06:12:00.000000', 'UTC', '[\"instagram\"]', 'failed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Invalid parameter', NULL, NULL, NULL, NULL, NULL, '2025-12-22 06:11:07.373000', '2025-12-22 06:14:24.824000', NULL, 3),
(50, 'hi121', 0, '[]', '2025-12-22 07:23:00.000000', 'UTC', '[\'twitter\', \'instagram\', \'facebook\', \'linkedin\']', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 07:22:05.007000', '2025-12-22 07:22:05.007000', NULL, 3),
(51, 'hi', 0, '[]', '2025-12-22 07:23:00.000000', 'UTC', '[\'twitter\', \'instagram\', \'facebook\', \'linkedin\']', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 07:22:43.402000', '2025-12-22 07:22:43.402000', NULL, 3),
(52, 'hi', 0, '[]', '2025-12-22 07:24:00.000000', 'UTC', '[\'instagram\']', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 07:23:26.172000', '2025-12-22 07:23:26.172000', NULL, 3),
(53, 'hi12123100', 0, '[]', '2025-12-22 07:25:00.000000', 'UTC', '[\'twitter\', \'instagram\', \'facebook\', \'linkedin\']', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 07:24:10.235000', '2025-12-22 07:24:10.235000', NULL, 3),
(54, 'hi1212121', 0, '[]', '2025-12-22 07:26:00.000000', 'UTC', '[\'twitter\', \'instagram\', \'facebook\', \'linkedin\']', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 07:24:35.183000', '2025-12-22 07:24:35.183000', NULL, 3),
(55, 'a', 0, '[]', '2025-12-22 08:08:00.000000', 'UTC', '[\'twitter\', \'instagram\', \'facebook\', \'linkedin\']', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 08:07:24.364000', '2025-12-22 08:07:24.364000', NULL, 3),
(56, 'aa', 0, '[\"posts/3/1766390896.264591.jpg\"]', '2025-12-22 08:09:00.000000', 'UTC', '[\"twitter\", \"instagram\", \"facebook\", \"linkedin\"]', 'posted', NULL, '2003014919873327142', NULL, 'urn:li:share:7408780650628968448', NULL, NULL, NULL, NULL, 'Error validating access token: The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons.', NULL, 'Facebook upload failed: Error validating access token: The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons.', NULL, NULL, NULL, NULL, NULL, '2025-12-22 08:08:16.285000', '2025-12-22 08:09:16.489000', '2025-12-22 08:09:16.489000', 3),
(57, 'a', 0, '[\"posts/3/1766391012.960245.jpg\"]', '2025-12-22 08:10:00.000000', 'UTC', '[\"twitter\", \"instagram\", \"facebook\", \"linkedin\"]', 'posted', NULL, '2003015425169465444', NULL, 'urn:li:share:7408781155778433024', NULL, NULL, NULL, NULL, 'Error validating access token: The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons.', NULL, 'Facebook upload failed: Error validating access token: The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons.', NULL, NULL, NULL, NULL, NULL, '2025-12-22 08:10:12.964000', '2025-12-22 08:11:16.893000', '2025-12-22 08:11:16.893000', 3),
(58, 'Aaaa', 0, '[\"posts/3/1766391414.636531.jpg\"]', '2025-12-22 08:17:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\", \"linkedin\"]', 'posted', NULL, '2003016968149016922', NULL, 'urn:li:share:7408782682014380032', NULL, NULL, NULL, NULL, '(#200) The permission(s) publish_actions are not available. It has been deprecated. If you want to provide a way for your app users to share content to Facebook, we encourage you to use our Sharing products instead.', NULL, 'Facebook upload failed: (#200) Unpublished posts must be posted to a page as the page itself.', NULL, NULL, NULL, NULL, NULL, '2025-12-22 08:16:54.640000', '2025-12-22 08:17:20.776000', '2025-12-22 08:17:20.776000', 3),
(59, 'Aaaa', 0, '[\"posts/3/1766391675.638648.png\"]', '2025-12-22 08:21:00.000000', 'UTC', '[\"instagram\", \"facebook\"]', 'failed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '(#200) The permission(s) publish_actions are not available. It has been deprecated. If you want to provide a way for your app users to share content to Facebook, we encourage you to use our Sharing products instead.', NULL, 'Facebook upload failed: (#200) Unpublished posts must be posted to a page as the page itself.', NULL, NULL, NULL, NULL, NULL, '2025-12-22 08:21:15.643000', '2025-12-22 08:22:11.631000', NULL, 3),
(60, '.', 0, '[\"posts/3/1766392074.809476.jpg\"]', '2025-12-22 08:28:00.000000', 'UTC', '[\"instagram\", \"facebook\"]', 'failed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '(#200) The permission(s) publish_actions are not available. It has been deprecated. If you want to provide a way for your app users to share content to Facebook, we encourage you to use our Sharing products instead.', NULL, 'Facebook upload failed: (#200) Unpublished posts must be posted to a page as the page itself.', NULL, NULL, NULL, NULL, NULL, '2025-12-22 08:27:54.812000', '2025-12-22 08:28:08.039000', NULL, 3),
(61, 'as', 0, '[]', '2025-12-22 08:31:00.000000', 'UTC', '[\"facebook\"]', 'failed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '(#200) If posting to a group, requires app being installed in the group, and \\\n          either publish_to_groups permission with user token, or both pages_read_engagement \\\n          and pages_manage_posts permission with page token; If posting to a page, \\\n          requires both pages_read_engagement and pages_manage_posts as an admin with \\\n          sufficient administrative permission', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 08:31:45.420000', '2025-12-22 08:32:04.584000', NULL, 3),
(62, 'a', 0, '[]', '2025-12-22 08:38:00.000000', 'UTC', '[\"facebook\"]', 'posted', '754646057738376_122115185157011938', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 08:38:35.730000', '2025-12-22 08:39:07.184000', '2025-12-22 08:39:07.184000', 3),
(63, 'a', 0, '[\"posts/3/1766392787.390989.jpg\"]', '2025-12-22 08:39:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\", \"linkedin\"]', 'posted', '122115185355011938', '2003022848600998194', '18081056404916868', 'urn:li:share:7408788557961560065', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 08:39:47.394000', '2025-12-22 08:40:41.716000', '2025-12-22 08:40:41.716000', 3),
(64, 'aaa', 0, '[]', '2025-12-22 09:04:00.000000', 'UTC', '[]', 'failed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 09:03:12.316000', '2025-12-22 09:04:46.660000', NULL, 3),
(65, 'a', 0, '[]', '2025-12-22 09:07:00.000000', 'UTC', '[]', 'failed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 09:07:38.492000', '2025-12-22 09:07:46.841000', NULL, 3),
(66, 'mm', 0, '[\"posts\\\\3\\\\1766394633_0.png\", \"posts\\\\3\\\\1766394633_1.png\", \"posts\\\\3\\\\1766394633_2.png\", \"posts\\\\3\\\\1766394633_3.jpg\"]', '2025-12-22 09:10:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\", \"linkedin\"]', 'posted', '122115188979011938', '2003030769007239517', '18373788025084050', 'urn:li:share:7408796485938495488', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 09:10:33.158000', '2025-12-22 09:12:11.815000', '2025-12-22 09:12:11.815000', 3),
(67, 'aa', 0, '[\"posts\\\\3\\\\1766400871_0.png\", \"posts\\\\3\\\\1766400871_1.png\", \"posts\\\\3\\\\1766400871_2.jpg\"]', '2025-12-22 10:54:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\", \"linkedin\"]', 'posted', '122115198249011938', '2003056949752217751', '17874432474465332', 'urn:li:share:7408822672173752320', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 10:54:31.797097', '2025-12-22 10:56:14.760318', '2025-12-22 10:56:14.759320', 3),
(68, 'HI form website', 0, '[\"posts/3/1766407589_0.png\", \"posts/3/1766407589_1.png\", \"posts/3/1766407589_2.jpg\"]', '2025-12-22 12:46:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\", \"linkedin\"]', 'posted', '122115300789011938', '2003382195613057272', '18064648082541351', 'urn:li:share:7409147892306874368', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-22 12:46:29.459125', '2025-12-23 08:28:33.087131', '2025-12-23 08:28:33.086903', 3),
(69, 'h', 0, '[\"posts/3/1766467651_0.png\"]', '2025-12-22 23:28:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\", \"linkedin\"]', 'posted', '122115300609011938', '2003382038599204977', '18096153796857952', 'urn:li:share:7409147735305654272', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-23 05:27:31.674469', '2025-12-23 08:27:55.662865', '2025-12-23 08:27:55.662603', 3),
(70, 'a', 0, '[\"posts/3/1766472501_0.jpg\"]', '2025-12-23 06:49:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\", \"linkedin\"]', 'posted', '122115300357011938', '2003381903307735363', '17919760971217804', 'urn:li:share:7409147600844754944', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-23 06:48:21.216604', '2025-12-23 08:27:23.624453', '2025-12-23 08:27:23.624206', 3),
(71, 'its from website', 0, '[\"posts/3/1766478702_0.png\"]', '2025-12-23 08:32:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\", \"linkedin\"]', 'posted', '122115301677011938', '2003384727441670429', '18089067760989582', 'urn:li:share:7409150423397228545', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-23 08:31:42.298437', '2025-12-23 08:38:36.537344', '2025-12-23 08:38:36.537067', 3),
(72, 'It will post on 2:45pm from website', 0, '[\"posts/3/1766479360_0.jpg\"]', '2025-12-23 08:45:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\", \"linkedin\"]', 'posted', '122115303039011938', '2003388662411854078', '18178643113363850', 'urn:li:share:7409154359780900864', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-23 08:42:40.815687', '2025-12-23 08:54:15.068505', '2025-12-23 08:54:15.068366', 3),
(73, 'hiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii', 0, '[\"posts/3/1766479964_0.jpg\"]', '2025-12-23 08:53:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\", \"linkedin\"]', 'posted', '122115302883011938', '2003388525186810368', '17890644645264279', 'urn:li:share:7409154222124101632', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-23 08:52:44.599831', '2025-12-23 08:53:42.291699', '2025-12-23 08:53:42.291462', 3),
(74, 'is it okh?', 0, '[\"posts/3/1766481617_0.jpg\"]', '2025-12-23 09:22:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\", \"linkedin\"]', 'posted', '122115306579011938', '2003395804447539628', '18085866941041781', 'urn:li:share:7409161502097707008', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-23 09:20:17.409835', '2025-12-23 09:22:37.988320', '2025-12-23 09:22:37.988058', 3),
(75, 'Aaa', 0, '[\"posts/3/1766481847_0.png\", \"posts/3/1766481847_1.png\", \"posts/3/1766481847_2.jpg\"]', '2025-12-23 09:25:00.000000', 'UTC', '[\"facebook\"]', 'posted', '122115306867011938', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-23 09:24:07.416499', '2025-12-23 09:25:08.701263', '2025-12-23 09:25:08.701016', 3),
(76, 'Hiiiii', 0, '[\"posts/3/1766484893_0.png\"]', '2025-12-23 10:14:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\"]', 'posted', '122115310929011938', '2003409139377299822', '18097763839895275', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-23 10:14:53.014995', '2025-12-23 10:15:35.281516', '2025-12-23 10:15:35.281329', 3),
(77, 'Hiiii', 0, '[\"posts/3/1766485797_0.png\"]', '2025-12-23 10:29:00.000000', 'UTC', '[\"instagram\", \"facebook\", \"twitter\"]', 'posted', '122115312153011938', '2003412935247560773', '18087292388023977', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-23 10:29:57.440148', '2025-12-23 10:30:40.651123', '2025-12-23 10:30:40.650948', 3),
(78, 'hiiii11213', 0, '[\"posts/3/1766492684_0.png\"]', '2025-12-23 12:23:00.000000', 'UTC', '[\"facebook\"]', 'failed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '(#200) The permission(s) publish_actions are not available. It has been deprecated. If you want to provide a way for your app users to share content to Facebook, we encourage you to use our Sharing products instead.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-23 12:24:44.259028', '2025-12-23 12:25:07.841361', NULL, 3);

-- --------------------------------------------------------

--
-- Table structure for table `site_configuration`
--

CREATE TABLE `site_configuration` (
  `id` bigint(20) NOT NULL,
  `key` varchar(100) NOT NULL,
  `value` longtext NOT NULL,
  `description` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `social_accounts`
--

CREATE TABLE `social_accounts` (
  `id` bigint(20) NOT NULL,
  `platform` varchar(20) NOT NULL,
  `account_name` varchar(200) NOT NULL,
  `token_expires_at` datetime(6) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `is_validated` tinyint(1) NOT NULL,
  `validation_error` longtext DEFAULT NULL,
  `last_validated_at` datetime(6) DEFAULT NULL,
  `connected_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `user_id` int(11) NOT NULL,
  `facebook_access_token` longtext DEFAULT NULL,
  `facebook_page_id` varchar(200) DEFAULT NULL,
  `instagram_access_token` longtext DEFAULT NULL,
  `instagram_business_account_id` varchar(200) DEFAULT NULL,
  `linkedin_access_token` longtext DEFAULT NULL,
  `linkedin_person_urn` varchar(200) DEFAULT NULL,
  `pinterest_access_token` longtext DEFAULT NULL,
  `pinterest_board_id` varchar(200) DEFAULT NULL,
  `telegram_bot_token` longtext DEFAULT NULL,
  `telegram_channel_id` varchar(200) DEFAULT NULL,
  `tiktok_access_token` longtext DEFAULT NULL,
  `tiktok_refresh_token` longtext DEFAULT NULL,
  `twitter_access_token` longtext DEFAULT NULL,
  `twitter_access_token_secret` longtext DEFAULT NULL,
  `twitter_api_key` varchar(500) DEFAULT NULL,
  `twitter_api_secret` varchar(500) DEFAULT NULL,
  `youtube_access_token` longtext DEFAULT NULL,
  `youtube_channel_id` varchar(200) DEFAULT NULL,
  `youtube_refresh_token` longtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `social_accounts`
--

INSERT INTO `social_accounts` (`id`, `platform`, `account_name`, `token_expires_at`, `status`, `is_active`, `is_validated`, `validation_error`, `last_validated_at`, `connected_at`, `updated_at`, `user_id`, `facebook_access_token`, `facebook_page_id`, `instagram_access_token`, `instagram_business_account_id`, `linkedin_access_token`, `linkedin_person_urn`, `pinterest_access_token`, `pinterest_board_id`, `telegram_bot_token`, `telegram_channel_id`, `tiktok_access_token`, `tiktok_refresh_token`, `twitter_access_token`, `twitter_access_token_secret`, `twitter_api_key`, `twitter_api_secret`, `youtube_access_token`, `youtube_channel_id`, `youtube_refresh_token`) VALUES
(1, 'facebook', 'Aa', NULL, 'active', 1, 0, '', NULL, '2025-12-20 10:42:42.376000', '2025-12-20 10:42:42.376000', 2, '', NULL, '', NULL, '', NULL, '', NULL, '', NULL, '', '', '', '', NULL, NULL, '', NULL, ''),
(10, 'twitter', '@triplyvisa', NULL, 'active', 1, 1, NULL, NULL, '2025-12-22 05:52:26.426000', '2025-12-22 05:52:26.426000', 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '1965325665160626179-foB8unmIR7h0oy3NvZzfLSMy3mhkLu', 'Y0U8RKlV3Ljm4Ok0jfd1LiySZXpGD1TtyvFG1a7HsRdYG', '2QgFysttD4wFqdPFxapbDMrUK', 'wTkEp7znXWGszksBegALIqUhGdyDO5UKuqRm7jxeVIsiRAlgDn', NULL, NULL, NULL),
(17, 'instagram', '@triplyvisa', NULL, 'active', 1, 1, NULL, NULL, '2025-12-22 08:39:06.138000', '2025-12-22 08:39:06.139000', 3, NULL, NULL, 'EAAQGStkMZC7QBQYHZC9YkXO1cO3nrAtGZCucQEjjXpUyg6UJibOq1DKCZBJUe5JauSxHcXYQoIIsgEdfG1skrfRTUBmfCMVHcwpsF7fC7ZBXLpJCnWkS7gLXSDRVfeq2M8NoN4ZCapKXboUjZCZAVDHs4D6Rmmd5dteXJwNfPvn9quBXXfMhYDSNWQLRvU31JiYNbrlx', '17841476826688601', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(18, 'facebook', 'Triply Visa', NULL, 'active', 1, 1, NULL, NULL, '2025-12-23 12:23:28.255252', '2025-12-23 12:23:28.255301', 3, 'EAF2iRZATSnBkBQd4Yk8jIe6NG49tYXFrQ5kwymwZBYJXUXT6gyKT2SW74F20stEBHZAHstZAMM2oj7cy9q3l1gQixe2oGJKDj42bvCyj4P7ia6FZABmhwRtGarATNMHYkGLcWAXz1La2wUfdJ6oloRSB7cQPNZAvUuXgdd9QiwjhvfI5hl7zyn3pER7dWt00gD', '754646057738376', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `user_profiles`
--

CREATE TABLE `user_profiles` (
  `id` bigint(20) NOT NULL,
  `is_approved` tinyint(1) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `company` varchar(200) DEFAULT NULL,
  `avatar` varchar(100) DEFAULT NULL,
  `subscription_plan` varchar(20) NOT NULL,
  `max_social_accounts` int(11) NOT NULL,
  `max_posts_per_month` int(11) NOT NULL,
  `posts_this_month` int(11) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `user_profiles`
--

INSERT INTO `user_profiles` (`id`, `is_approved`, `phone`, `company`, `avatar`, `subscription_plan`, `max_social_accounts`, `max_posts_per_month`, `posts_this_month`, `created_at`, `updated_at`, `user_id`) VALUES
(2, 1, NULL, NULL, '', 'free', 3, 30, 0, '2025-12-22 10:00:19.413892', '2025-12-22 12:50:55.263349', 2),
(3, 1, NULL, NULL, '', 'business', 4, 100, 4, '2025-12-22 10:00:19.418889', '2025-12-23 12:24:44.295097', 3),
(4, 1, NULL, NULL, '', 'business', 4, 200, 0, '2025-12-23 04:51:54.126124', '2025-12-23 04:55:55.411191', 4),
(5, 1, '+8801977959900', 'Abedin Tech', '', 'free', 3, 30, 0, '2025-12-23 09:35:46.343194', '2025-12-23 09:36:37.126507', 5);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `analytics`
--
ALTER TABLE `analytics`
  ADD PRIMARY KEY (`id`),
  ADD KEY `analytics_user_id_e4a682_idx` (`user_id`,`platform`),
  ADD KEY `analytics_post_id_9189b3_idx` (`post_id`,`platform`);

--
-- Indexes for table `auth_group`
--
ALTER TABLE `auth_group`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `auth_group_permissions`
--
ALTER TABLE `auth_group_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auth_group_permissions_group_id_permission_id_0cd325b0_uniq` (`group_id`,`permission_id`),
  ADD KEY `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` (`permission_id`);

--
-- Indexes for table `auth_permission`
--
ALTER TABLE `auth_permission`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auth_permission_content_type_id_codename_01ab375a_uniq` (`content_type_id`,`codename`);

--
-- Indexes for table `auth_user`
--
ALTER TABLE `auth_user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `auth_user_groups`
--
ALTER TABLE `auth_user_groups`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auth_user_groups_user_id_group_id_94350c0c_uniq` (`user_id`,`group_id`),
  ADD KEY `auth_user_groups_group_id_97559544_fk_auth_group_id` (`group_id`);

--
-- Indexes for table `auth_user_user_permissions`
--
ALTER TABLE `auth_user_user_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auth_user_user_permissions_user_id_permission_id_14a6b632_uniq` (`user_id`,`permission_id`),
  ADD KEY `auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm` (`permission_id`);

--
-- Indexes for table `django_admin_log`
--
ALTER TABLE `django_admin_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `django_admin_log_content_type_id_c4bce8eb_fk_django_co` (`content_type_id`),
  ADD KEY `django_admin_log_user_id_c564eba6_fk_auth_user_id` (`user_id`);

--
-- Indexes for table `django_content_type`
--
ALTER TABLE `django_content_type`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `django_content_type_app_label_model_76bd3d3b_uniq` (`app_label`,`model`);

--
-- Indexes for table `django_migrations`
--
ALTER TABLE `django_migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `django_session`
--
ALTER TABLE `django_session`
  ADD PRIMARY KEY (`session_key`),
  ADD KEY `django_session_expire_date_a5c62663` (`expire_date`);

--
-- Indexes for table `posts`
--
ALTER TABLE `posts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `posts_user_id_4291758d_fk_auth_user_id` (`user_id`);

--
-- Indexes for table `site_configuration`
--
ALTER TABLE `site_configuration`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `key` (`key`);

--
-- Indexes for table `social_accounts`
--
ALTER TABLE `social_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `social_accounts_user_id_platform_account_name_bb7e6436_uniq` (`user_id`,`platform`,`account_name`);

--
-- Indexes for table `user_profiles`
--
ALTER TABLE `user_profiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `analytics`
--
ALTER TABLE `analytics`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auth_group`
--
ALTER TABLE `auth_group`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `auth_group_permissions`
--
ALTER TABLE `auth_group_permissions`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auth_permission`
--
ALTER TABLE `auth_permission`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=45;

--
-- AUTO_INCREMENT for table `auth_user`
--
ALTER TABLE `auth_user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `auth_user_groups`
--
ALTER TABLE `auth_user_groups`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `auth_user_user_permissions`
--
ALTER TABLE `auth_user_user_permissions`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=89;

--
-- AUTO_INCREMENT for table `django_admin_log`
--
ALTER TABLE `django_admin_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `django_content_type`
--
ALTER TABLE `django_content_type`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `django_migrations`
--
ALTER TABLE `django_migrations`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `posts`
--
ALTER TABLE `posts`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=79;

--
-- AUTO_INCREMENT for table `site_configuration`
--
ALTER TABLE `site_configuration`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `social_accounts`
--
ALTER TABLE `social_accounts`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `user_profiles`
--
ALTER TABLE `user_profiles`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `analytics`
--
ALTER TABLE `analytics`
  ADD CONSTRAINT `analytics_post_id_65afaf95_fk_posts_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`),
  ADD CONSTRAINT `analytics_user_id_6b29e2d1_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `auth_group_permissions`
--
ALTER TABLE `auth_group_permissions`
  ADD CONSTRAINT `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  ADD CONSTRAINT `auth_group_permissions_group_id_b120cbf9_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`);

--
-- Constraints for table `auth_permission`
--
ALTER TABLE `auth_permission`
  ADD CONSTRAINT `auth_permission_content_type_id_2f476e4b_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`);

--
-- Constraints for table `auth_user_groups`
--
ALTER TABLE `auth_user_groups`
  ADD CONSTRAINT `auth_user_groups_group_id_97559544_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`),
  ADD CONSTRAINT `auth_user_groups_user_id_6a12ed8b_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `auth_user_user_permissions`
--
ALTER TABLE `auth_user_user_permissions`
  ADD CONSTRAINT `auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  ADD CONSTRAINT `auth_user_user_permissions_user_id_a95ead1b_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `django_admin_log`
--
ALTER TABLE `django_admin_log`
  ADD CONSTRAINT `django_admin_log_content_type_id_c4bce8eb_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`),
  ADD CONSTRAINT `django_admin_log_user_id_c564eba6_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `posts`
--
ALTER TABLE `posts`
  ADD CONSTRAINT `posts_user_id_4291758d_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `social_accounts`
--
ALTER TABLE `social_accounts`
  ADD CONSTRAINT `social_accounts_user_id_2b7b8b2b_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `user_profiles`
--
ALTER TABLE `user_profiles`
  ADD CONSTRAINT `user_profiles_user_id_8c5ab5fe_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
