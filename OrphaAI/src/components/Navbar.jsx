import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { ORPHAAI_LOGO_SRC, ORPHAAI_LOGO_ALT } from '../assets/logo';

const NAV_ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'predict', label: 'Predict' },
  { id: 'network', label: 'Interaction Network' },
  { id: 'drugs', label: 'Drug Library' },
  { id: 'diseases', label: 'Disease Library' },
];

export default function Navbar(props) {
  // Support both prop conventions seamlessly
  const activeTab = props.activeTab || props.page || 'home';
  const setActiveTab = props.setActiveTab || props.setPage || (() => {});
  const user = props.user || null;
  const onSignOut = props.onSignOut || props.logout || (() => {});
  const onSignInClick = props.onSignInClick || (() => {
    if (props.setPage) props.setPage('login');
    else if (props.setActiveTab) props.setActiveTab('login');
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const handleSelect = (id) => {
    setActiveTab(id);
    setMenuOpen(false);
    setProfileOpen(false);
  };

  const handleLogout = () => {
    onSignOut();
    setProfileOpen(false);
    setMenuOpen(false);
    setActiveTab('home');
  };

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const userDisplayName = user
    ? (`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email || 'User')
    : '';

  const userInitial = userDisplayName ? userDisplayName[0].toUpperCase() : 'U';

  return (
    <>
      {/* Bulletproof CSS responsive rules that work natively in all browsers and Android WebViews */}
      <style>{`
        .orpha-desktop-nav-group {
          display: flex;
          align-items: center;
          gap: 6px;
          background-color: #f8fafc;
          padding: 6px 10px;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
        }
        .orpha-mobile-menu-btn {
          display: none;
        }
        .orpha-desktop-user-label {
          display: inline;
        }
        .orpha-mobile-drawer {
          display: block;
        }

        @media (max-width: 1023px) {
          .orpha-desktop-nav-group {
            display: none !important;
          }
          .orpha-mobile-menu-btn {
            display: flex !important;
          }
          .orpha-desktop-user-label {
            display: none !important;
          }
        }

        @media (min-width: 1024px) {
          .orpha-desktop-nav-group {
            display: flex !important;
          }
          .orpha-mobile-menu-btn {
            display: none !important;
          }
          .orpha-desktop-user-label {
            display: inline !important;
          }
          .orpha-mobile-drawer {
            display: none !important;
          }
        }
      `}</style>

      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          width: '100%',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          boxSizing: 'border-box',
        }}
      >
        {/* Main Single-Line Bar */}
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 16px',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            position: 'relative',
            boxSizing: 'border-box',
          }}
        >
          {/* Left: Brand Logo */}
          <div
            onClick={() => handleSelect('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              flexShrink: 0,
              userSelect: 'none',
            }}
          >
            {ORPHAAI_LOGO_SRC ? (
              <img
                src={ORPHAAI_LOGO_SRC}
                alt={ORPHAAI_LOGO_ALT || 'OrphaAI Logo'}
                style={{
                  width: '36px',
                  height: '36px',
                  objectFit: 'contain',
                  flexShrink: 0,
                  filter: 'drop-shadow(0 2px 4px rgba(15,110,86,0.18))',
                }}
              />
            ) : (
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#065f46',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 2a3 3 0 100 6 3 3 0 000-6zm-6 14a3 3 0 100 6 3 3 0 000-6zm12 0a3 3 0 100 6 3 3 0 000-6z" />
                </svg>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                Orpha<span style={{ color: '#047857' }}>AI</span>
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  backgroundColor: '#065f46',
                  color: '#ffffff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                BIOMED
              </span>
            </div>
          </div>

          {/* Center: Desktop Navigation Links (Hidden on Mobile via CSS) */}
          <div className="orpha-desktop-nav-group">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: isActive ? '#f0fdf4' : 'transparent',
                    color: isActive ? '#065f46' : '#64748b',
                    fontWeight: isActive ? 700 : 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Right: User Status / Sign In & Hamburger Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            {user ? (
              <div ref={profileRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setProfileOpen((prev) => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '5px 10px 5px 6px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                  aria-label="User Profile"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={userDisplayName}
                      referrerPolicy="no-referrer"
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        backgroundColor: '#065f46',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {userInitial}
                    </div>
                  )}
                  <span
                    className="orpha-desktop-user-label"
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#1e293b',
                      maxWidth: '120px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {userDisplayName}
                  </span>
                  <ChevronDown size={14} color="#64748b" style={{ flexShrink: 0 }} />
                </button>

                {/* Profile Dropdown */}
                {profileOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 8px)',
                      width: '240px',
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                      padding: '14px',
                      zIndex: 1001,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          backgroundColor: '#065f46',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '15px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {userInitial}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '14px',
                            color: '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {userDisplayName}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {user.email || ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                      <button
                        onClick={handleLogout}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #fecdd3',
                          backgroundColor: '#fff1f2',
                          color: '#e11d48',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onSignInClick}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#065f46',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(6,95,70,0.2)',
                  whiteSpace: 'nowrap',
                }}
              >
                Sign In
              </button>
            )}

            {/* Mobile Menu Hamburger Button (Hidden on Desktop via CSS) */}
            <button
              className="orpha-mobile-menu-btn"
              onClick={() => {
                setMenuOpen((prev) => !prev);
                setProfileOpen(false);
              }}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#334155',
                cursor: 'pointer',
              }}
              aria-label="Toggle Navigation Menu"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Dropdown */}
        {menuOpen && (
          <div
            className="orpha-mobile-drawer"
            style={{
              backgroundColor: '#ffffff',
              borderTop: '1px solid #f1f5f9',
              padding: '8px 16px 14px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            }}
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isActive ? '#f0fdf4' : 'transparent',
                    color: isActive ? '#065f46' : '#475569',
                    fontSize: '14px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    marginBottom: '4px',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );
}
